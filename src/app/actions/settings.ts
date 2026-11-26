"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantFilter } from "@/lib/access";
import { db } from "@/lib/db";
import { buildLeadMail } from "@/lib/lead-notify-mail";
import { processInboundMail, reprocessInbound } from "@/lib/lead-service";
import { mailerConfigured, mailerInfo, missingMailerVars, parseEmailList, sendMail } from "@/lib/mailer";
import { requireAdmin } from "@/lib/session";

export type SettingsState = { error?: string; ok?: string } | undefined;

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Ungültige Eingabe";
}

export async function reprocessInboundAction(inboundId: string): Promise<SettingsState> {
  const admin = await requireAdmin();
  const inbound = await db.inboundEmail.findFirst({ where: { id: inboundId, ...tenantFilter(admin) }, select: { id: true } });
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
  });
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
  if (!mailerConfigured()) return { error: `Auf dem Server fehlt: ${missingMailerVars().join(", ")}` };
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: admin.tenantId } });
  const to = parseEmailList(tenant.leadNotifyEmails);
  if (to.length === 0) return { error: "Bitte zuerst mindestens eine Adresse speichern." };
  const latest = await db.lead.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, receivedAt: true, assignedTo: { select: { displayName: true } } },
  });
  const lead = latest
    ? { ...latest, assignedTo: latest.assignedTo?.displayName ?? null }
    : { id: "beispiel", fullName: "Max Mustermann", receivedAt: new Date(), assignedTo: null };
  const mail = buildLeadMail(tenant, lead);
  try {
    await sendMail({ to, ...mail, subject: `[Test] ${mail.subject}` });
  } catch (err) {
    return { error: `Versand fehlgeschlagen (${mailerInfo()}): ${(err as Error).message}` };
  }
  return { ok: `Test-Mail an ${to.join(", ")} verschickt.` };
}
