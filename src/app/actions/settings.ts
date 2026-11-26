"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantFilter } from "@/lib/access";
import { db } from "@/lib/db";
import { buildLeadMail } from "@/lib/lead-notify-mail";
import { ImapFlow } from "imapflow";
import { imapSettings, IMAP_SETTING_KEY, readStoredImap, type StoredImap } from "@/lib/imap-settings";
import { parseKeywords, RECIPIENT_KEYWORDS_KEY, SUBJECT_KEYWORDS_KEY } from "@/lib/lead-intake";
import { processInboundMail, reprocessInbound } from "@/lib/lead-service";
import { encryptSecret } from "@/lib/secret-box";
import { mailerConfigured, mailerInfo, missingMailerVars, parseEmailList, readStoredSmtp, sendMail, smtpConfig, SMTP_SETTING_KEY, verifySmtp, type StoredSmtp } from "@/lib/mailer";
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
  }, { skipSubjectFilter: true });
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
  if (!(await mailerConfigured())) return { error: `SMTP ist nicht vollständig eingerichtet – es fehlt: ${(await missingMailerVars()).join(", ")}` };
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
    return { error: `Versand fehlgeschlagen (${await mailerInfo()}): ${(err as Error).message}` };
  }
  return { ok: `Test-Mail an ${to.join(", ")} verschickt.` };
}

const smtpSchema = z.object({
  host: z.string().trim().min(1, "Server fehlt").max(200),
  port: z.coerce.number().int().min(1, "Ungültiger Port").max(65535, "Ungültiger Port"),
  user: z.string().trim().min(1, "Benutzer fehlt").max(200),
  from: z.string().trim().max(300),
});

/** Speichert den SMTP-Zugang in der App (Passwort verschlüsselt). Leeres Passwortfeld behält das bisherige. */
export async function saveSmtpSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = smtpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const password = String(formData.get("password") ?? "");
  const stored = await readStoredSmtp();
  const current = await smtpConfig();
  let pass = stored?.pass;
  if (password) pass = encryptSecret(password);
  else if (!pass && current.pass) pass = encryptSecret(current.pass); // bisheriges Server-Passwort übernehmen
  if (!pass) return { error: "Bitte das Passwort eingeben." };
  const value: StoredSmtp = { ...parsed.data, secure: formData.get("secure") === "on", pass };
  await db.setting.upsert({ where: { key: SMTP_SETTING_KEY }, update: { value: JSON.stringify(value) }, create: { key: SMTP_SETTING_KEY, value: JSON.stringify(value) } });
  revalidatePath("/[tenant]/settings", "layout");
  return { ok: "SMTP-Einstellungen gespeichert." };
}

/** Löscht die in der App gespeicherten Werte; danach gelten wieder die SMTP_*-Variablen des Servers. */
export async function resetSmtpSettings(): Promise<SettingsState> {
  await requireAdmin();
  await db.setting.deleteMany({ where: { key: SMTP_SETTING_KEY } });
  revalidatePath("/[tenant]/settings", "layout");
  return { ok: "Gespeicherte Werte gelöscht – es gelten wieder die Server-Variablen." };
}

/** Prüft Verbindung und Anmeldung beim SMTP-Server und schickt auf Wunsch eine Test-Mail. */
export async function testSmtp(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();
  const c = await smtpConfig();
  if (!(await mailerConfigured())) return { error: `SMTP ist nicht vollständig eingerichtet – es fehlt: ${(await missingMailerVars()).join(", ")}` };
  try {
    await verifySmtp(c);
  } catch (err) {
    return { error: `Verbindung fehlgeschlagen (${await mailerInfo()}): ${(err as Error).message}` };
  }
  const to = String(formData.get("to") ?? "").trim() || admin.email;
  if (!z.email().safeParse(to).success) return { error: "Ungültige Empfängeradresse." };
  try {
    await sendMail({
      to: [to],
      subject: "[Test] SMTP-Einstellungen",
      text: "Der Mailversand der Function Concept Lead Software funktioniert.",
      html: "<p>Der Mailversand der Function Concept Lead Software funktioniert.</p>",
    });
  } catch (err) {
    return { error: `Versand fehlgeschlagen: ${(err as Error).message}` };
  }
  return { ok: `Verbindung OK, Test-Mail an ${to} verschickt.` };
}

async function saveKeywordSetting(key: string, keywords: string[]) {
  const value = keywords.join("\n");
  if (value) await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  else await db.setting.deleteMany({ where: { key } });
}

/** Speichert die Bedingungen, unter denen eine Mail aus dem Postfach als Lead importiert wird. */
export async function saveIntakeRules(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const subject = parseKeywords(String(formData.get("subject") ?? ""));
  const recipient = parseKeywords(String(formData.get("recipient") ?? ""));
  for (const list of [subject, recipient]) {
    if (list.length > 20) return { error: "Höchstens 20 Einträge pro Bedingung." };
    if (list.some((k) => k.length > 100)) return { error: "Ein Eintrag ist zu lang (max. 100 Zeichen)." };
  }
  await saveKeywordSetting(SUBJECT_KEYWORDS_KEY, subject);
  await saveKeywordSetting(RECIPIENT_KEYWORDS_KEY, recipient);
  revalidatePath("/[tenant]/settings/intake", "page");
  const quote = (list: string[]) => list.map((k) => `„${k}“`).join(" oder ");
  const parts = [
    subject.length ? `Betreff enthält ${quote(subject)}` : "Betreff beliebig",
    recipient.length ? `Empfänger enthält ${quote(recipient)}` : "Empfänger beliebig",
  ];
  return { ok: `Gespeichert: ${parts.join(" · ")}.` };
}

const imapSchema = z.object({
  host: z.string().trim().min(1, "Server fehlt").max(200),
  port: z.coerce.number().int().min(1, "Ungültiger Port").max(65535, "Ungültiger Port"),
  user: z.string().trim().min(1, "Benutzer fehlt").max(200),
});

async function writeImap(value: StoredImap) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key: IMAP_SETTING_KEY }, update: { value: json }, create: { key: IMAP_SETTING_KEY, value: json } });
  revalidatePath("/[tenant]/settings", "layout");
}

/** Speichert das Lead-Postfach (IMAP) in der App; Passwort verschlüsselt, leeres Feld behält das bisherige. */
export async function saveImapSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = imapSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const password = String(formData.get("password") ?? "");
  const stored = await readStoredImap();
  const current = await imapSettings();
  let pass = stored?.pass;
  if (password) pass = encryptSecret(password);
  else if (!pass && current.pass) pass = encryptSecret(current.pass);
  if (!pass) return { error: "Bitte das Passwort eingeben." };
  await writeImap({ ...parsed.data, secure: formData.get("secure") === "on", pass });
  return { ok: "Postfach gespeichert." };
}

/** Übernimmt Benutzer und Passwort vom SMTP-Zugang (gleiches Postfach für Empfang und Versand). */
export async function copyImapFromSmtp(): Promise<SettingsState> {
  await requireAdmin();
  const smtp = await smtpConfig();
  if (!smtp.user || !smtp.pass || !smtp.host) return { error: "Der SMTP-Zugang ist noch nicht vollständig eingerichtet." };
  const current = await imapSettings();
  const value: StoredImap = {
    host: current.host && current.source === "app" ? current.host : smtp.host,
    port: current.port,
    secure: current.secure,
    user: smtp.user,
    pass: encryptSecret(smtp.pass),
  };
  await writeImap(value);
  return { ok: `Übernommen: ${value.user} @ ${value.host}:${value.port}. Bitte jetzt testen.` };
}

export async function resetImapSettings(): Promise<SettingsState> {
  await requireAdmin();
  await db.setting.deleteMany({ where: { key: IMAP_SETTING_KEY } });
  revalidatePath("/[tenant]/settings", "layout");
  return { ok: "Gespeicherte Werte gelöscht – es gelten wieder die Server-Variablen." };
}

/** Meldet sich am Postfach an und zeigt, wie viele Mails im Posteingang liegen. */
export async function testImap(): Promise<SettingsState> {
  await requireAdmin();
  const c = await imapSettings();
  if (!c.host || !c.user || !c.pass) return { error: "Das Postfach ist noch nicht vollständig eingerichtet." };
  const client = new ImapFlow({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass }, logger: false });
  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true, unseen: true });
    const uidplus = client.capabilities.has("UIDPLUS");
    await client.logout();
    return uidplus
      ? { ok: `Anmeldung OK – Posteingang: ${status ? status.messages : "?"} Mail(s), davon ${status ? status.unseen : "?"} ungelesen.` }
      : { error: "Anmeldung OK, aber der Server unterstützt kein gezieltes Löschen (UIDPLUS) – der Import würde nicht laufen." };
  } catch (err) {
    client.close();
    const response = (err as { response?: unknown })?.response;
    const auth = typeof response === "string" && /AUTHENTICATIONFAILED|authentication failed/i.test(response);
    return { error: auth ? "Anmeldung fehlgeschlagen – Benutzer oder Passwort prüfen." : `Verbindung fehlgeschlagen: ${(err as Error).message}` };
  }
}
