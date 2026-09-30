"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { processInboundMail, reprocessInbound } from "@/lib/lead-service";
import { requireAdmin } from "@/lib/session";

export type SettingsState = { error?: string; ok?: string } | undefined;

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Benutzername: 3–32 Zeichen, nur a–z, 0–9, Punkt, Minus, Unterstrich"),
  email: z.email("Ungültige E-Mail-Adresse"),
  displayName: z.string().trim().min(1, "Anzeigename fehlt").max(60),
  role: z.enum(["ADMIN", "SALES"]),
});

const passwordSchema = z.string().min(8, "Passwort muss mindestens 8 Zeichen haben");

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

export async function createUser(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const pw = passwordSchema.safeParse(formData.get("password"));
  if (!pw.success) return { error: firstError(pw.error) };

  const maxOrder = await db.user.aggregate({ _max: { distOrder: true } });
  try {
    await db.user.create({
      data: {
        ...parsed.data,
        passwordHash: await bcrypt.hash(pw.data, 12),
        distOrder: (maxOrder._max.distOrder ?? 0) + 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Dieser Benutzername ist schon vergeben." };
    }
    throw err;
  }
  await resetCounters();
  revalidatePath("/settings", "layout");
  return { ok: "Mitglied angelegt." };
}

export async function updateUser(userId: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const active = formData.get("active") === "on";
  if (userId === admin.id && (!active || parsed.data.role !== "ADMIN")) {
    return { error: "Du kannst dich nicht selbst deaktivieren oder die Admin-Rolle entziehen." };
  }

  const password = String(formData.get("password") ?? "");
  let passwordHash: string | undefined;
  if (password) {
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) return { error: firstError(pw.error) };
    passwordHash = await bcrypt.hash(pw.data, 12);
  }

  try {
    await db.user.update({ where: { id: userId }, data: { ...parsed.data, active, ...(passwordHash ? { passwordHash } : {}) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Dieser Benutzername ist schon vergeben." };
    }
    throw err;
  }
  await resetCounters();
  revalidatePath("/settings", "layout");
  return { ok: password ? "Gespeichert, Passwort geändert." : "Gespeichert." };
}

/** Zähler zurücksetzen, damit neue Einstellungen sofort sauber greifen. */
async function resetCounters() {
  await db.user.updateMany({ data: { distCurrent: 0 } });
}

const distributionSchema = z.array(
  z.object({
    id: z.string(),
    weight: z.number().int().min(1).max(10),
    paused: z.boolean(),
  }),
);

/** Speichert Reihenfolge (Position im Array), Gewicht und Pause der Vertriebler. */
export async function saveDistribution(entries: unknown): Promise<SettingsState> {
  await requireAdmin();
  const parsed = distributionSchema.safeParse(entries);
  if (!parsed.success) return { error: "Ungültige Einstellungen" };

  await db.$transaction(
    parsed.data.map((e, index) =>
      db.user.update({
        where: { id: e.id },
        data: { distOrder: index, distWeight: e.weight, distPaused: e.paused, distCurrent: 0 },
      }),
    ),
  );
  revalidatePath("/settings/distribution");
  return { ok: "Verteilung gespeichert." };
}

export async function reprocessInboundAction(inboundId: string): Promise<SettingsState> {
  await requireAdmin();
  const result = await reprocessInbound(inboundId);
  revalidatePath("/settings/mailbox");
  return result.status === "PROCESSED" ? { ok: "Lead angelegt." } : { error: "error" in result ? result.error : "Fehler" };
}

/** Lead manuell aus eingefügtem JSON anlegen (zum Testen, solange kein Postfach verbunden ist). */
export async function manualImport(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const text = String(formData.get("json") ?? "");
  const result = await processInboundMail({
    messageId: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}@leadcenter`,
    from: `Manueller Import (${admin.displayName})`,
    subject: "Manueller Import",
    receivedAt: new Date(),
    text,
  });
  revalidatePath("/settings/mailbox");
  revalidatePath("/leads");
  if (result.status === "PROCESSED") {
    const who = result.assignedToId
      ? (await db.user.findUnique({ where: { id: result.assignedToId }, select: { displayName: true } }))?.displayName
      : null;
    return { ok: `Lead angelegt${who ? ` und ${who} zugewiesen` : " (kein aktiver Vertriebler verfügbar)"}.` };
  }
  return { error: "error" in result ? result.error : "Duplikat" };
}
