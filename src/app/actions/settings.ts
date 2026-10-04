"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildLeadMail } from "@/lib/lead-notify-mail";
import { processInboundMail, reprocessInbound } from "@/lib/lead-service";
import { mailerConfigured, parseEmailList, sendMail } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";
import { emailTaken, usernameFromEmail } from "@/lib/users";

export type SettingsState = { error?: string; ok?: string } | undefined;

const userSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Ungültige E-Mail-Adresse")),
  displayName: z.string().trim().min(1, "Anzeigename fehlt").max(60),
  role: z.enum(["ADMIN", "SALES"]),
});

const passwordSchema = z.string().min(8, "Passwort muss mindestens 8 Zeichen haben");

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

export async function createUser(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const pw = passwordSchema.safeParse(formData.get("password"));
  if (!pw.success) return { error: firstError(pw.error) };

  if (await emailTaken(db, admin.tenantId, parsed.data.email)) return { error: "Diese E-Mail-Adresse ist in diesem Dashboard schon vergeben." };

  const maxOrder = await db.user.aggregate({ where: { tenantId: admin.tenantId }, _max: { distOrder: true } });
  try {
    await db.user.create({
      data: {
        ...parsed.data,
        username: await usernameFromEmail(db, admin.tenantId, parsed.data.email),
        tenantId: admin.tenantId,
        passwordHash: await bcrypt.hash(pw.data, 12),
        distOrder: (maxOrder._max.distOrder ?? 0) + 1,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Mitglied konnte nicht angelegt werden, bitte erneut versuchen." };
    }
    throw err;
  }
  await resetCounters(admin.tenantId);
  revalidatePath("/[tenant]/settings", "layout");
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

  const target = await db.user.findFirst({ where: { id: userId, tenantId: admin.tenantId }, select: { id: true } });
  if (!target) return { error: "Mitglied nicht gefunden." };
  if (await emailTaken(db, admin.tenantId, parsed.data.email, userId)) return { error: "Diese E-Mail-Adresse ist in diesem Dashboard schon vergeben." };

  await db.user.update({ where: { id: userId }, data: { ...parsed.data, active, ...(passwordHash ? { passwordHash } : {}) } });
  await resetCounters(admin.tenantId);
  revalidatePath("/[tenant]/settings", "layout");
  return { ok: password ? "Gespeichert, Passwort geändert." : "Gespeichert." };
}

/** Zähler zurücksetzen, damit neue Einstellungen sofort sauber greifen. */
async function resetCounters(tenantId: string) {
  await db.user.updateMany({ where: { tenantId }, data: { distCurrent: 0 } });
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
  const admin = await requireAdmin();
  const parsed = distributionSchema.safeParse(entries);
  if (!parsed.success) return { error: "Ungültige Einstellungen" };

  await db.$transaction(
    parsed.data.map((e, index) =>
      db.user.updateMany({
        where: { id: e.id, tenantId: admin.tenantId },
        data: { distOrder: index, distWeight: e.weight, distPaused: e.paused, distCurrent: 0 },
      }),
    ),
  );
  revalidatePath("/[tenant]/settings/distribution", "page");
  return { ok: "Verteilung gespeichert." };
}

export async function reprocessInboundAction(inboundId: string): Promise<SettingsState> {
  const admin = await requireAdmin();
  const inbound = await db.inboundEmail.findFirst({ where: { id: inboundId, tenantId: admin.tenantId }, select: { id: true } });
  if (!inbound) return { error: "Mail nicht gefunden." };
  const result = await reprocessInbound(inboundId);
  revalidatePath("/[tenant]/settings/mailbox", "page");
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
  }, admin.tenantId);
  revalidatePath("/[tenant]/settings/mailbox", "page");
  revalidatePath("/[tenant]/leads", "page");
  if (result.status === "PROCESSED") {
    const who = result.assignedToId
      ? (await db.user.findUnique({ where: { id: result.assignedToId }, select: { displayName: true } }))?.displayName
      : null;
    return { ok: `Lead angelegt${who ? ` und ${who} zugewiesen` : " (kein aktiver Vertriebler verfügbar)"}.` };
  }
  return { error: "error" in result ? result.error : "Duplikat" };
}

const notifyEmailsSchema = z.array(z.email("Ungültige E-Mail-Adresse")).max(10, "Höchstens 10 Adressen");

/** Speichert die Adressen, die bei jedem neuen Lead per Mail benachrichtigt werden. */
export async function saveLeadNotifyEmails(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const emails = parseEmailList(String(formData.get("emails") ?? ""));
  const parsed = notifyEmailsSchema.safeParse(emails);
  if (!parsed.success) {
    const bad = parsed.error.issues[0]?.path[0];
    return { error: typeof bad === "number" ? `Ungültige E-Mail-Adresse: ${emails[bad]}` : firstError(parsed.error) };
  }
  const value = [...new Set(parsed.data.map((e) => e.toLowerCase()))].join(", ");
  if (value.length > 1000) return { error: "Zu viele Adressen" };
  await db.tenant.update({ where: { id: admin.tenantId }, data: { leadNotifyEmails: value } });
  revalidatePath("/[tenant]/settings/notifications", "page");
  return { ok: value ? "Gespeichert." : "Gespeichert – E-Mail-Benachrichtigung ist aus." };
}

/** Schickt eine Beispiel-Mail mit dem neuesten Lead (oder Testdaten) an die gespeicherten Adressen. */
export async function sendTestLeadMail(): Promise<SettingsState> {
  const admin = await requireAdmin();
  if (!mailerConfigured()) return { error: "SMTP ist auf dem Server noch nicht eingerichtet." };
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: admin.tenantId } });
  const to = parseEmailList(tenant.leadNotifyEmails);
  if (to.length === 0) return { error: "Bitte zuerst mindestens eine Adresse speichern." };
  const latest = await db.lead.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, email: true, phone: true, receivedAt: true, assignedTo: { select: { displayName: true } } },
  });
  const lead = latest
    ? { ...latest, assignedTo: latest.assignedTo?.displayName ?? null }
    : { id: "beispiel", fullName: "Max Mustermann", email: "max@example.com", phone: "+491701234567", receivedAt: new Date(), assignedTo: null };
  const mail = buildLeadMail(tenant, lead);
  try {
    await sendMail({ to, ...mail, subject: `[Test] ${mail.subject}` });
  } catch (err) {
    return { error: `Versand fehlgeschlagen: ${(err as Error).message}` };
  }
  return { ok: `Test-Mail an ${to.join(", ")} verschickt.` };
}
