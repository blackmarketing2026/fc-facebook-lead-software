import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { decryptSecret } from "./secret-box";
import { isRestrictedUser, isTenantLocked } from "./access-lock";

function configured(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("PLATZHALTER");
}

/** Beim Einfügen in Vercel mitkopierte Leerzeichen und Anführungszeichen entfernen. */
function clean(value: string | undefined): string | undefined {
  return value?.trim().replace(/^(["'])(.*)$/, "$2");
}

/** Setting-Schlüssel der in der App gespeicherten SMTP-Einstellungen (Passwort verschlüsselt). */
export const SMTP_SETTING_KEY = "smtp.config";

export type StoredSmtp = { host: string; port: number; secure: boolean; user: string; from: string; pass?: string };

export async function readStoredSmtp(): Promise<StoredSmtp | null> {
  const row = await db.setting.findUnique({ where: { key: SMTP_SETTING_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as StoredSmtp;
  } catch {
    return null;
  }
}

export type SmtpConfig = { host?: string; port: number; secure: boolean; user?: string; pass?: string; from?: string; source: "app" | "env" };

/** Wirksamer SMTP-Zugang: in der App gespeicherte Werte gehen vor den SMTP_*-Variablen des Servers. */
export async function smtpConfig(): Promise<SmtpConfig> {
  const stored = await readStoredSmtp();
  if (stored?.host) {
    const pass = stored.pass ? decryptSecret(stored.pass) ?? undefined : undefined;
    return { host: stored.host, port: stored.port, secure: stored.secure, user: stored.user || undefined, pass, from: stored.from || stored.user || undefined, source: "app" };
  }
  const env = process.env;
  const user = clean(env.SMTP_USER);
  const from = configured(env.SMTP_FROM) ? clean(env.SMTP_FROM) : user;
  return { host: clean(env.SMTP_HOST), port: Number(env.SMTP_PORT || 465), secure: env.SMTP_SECURE !== "false", user, pass: clean(env.SMTP_PASS), from, source: "env" };
}

/** Pflichtangaben, die für den Versand noch fehlen (für Hinweise in den Einstellungen). */
export async function missingMailerVars(): Promise<string[]> {
  const c = await smtpConfig();
  return [["Server", c.host], ["Benutzer", c.user], ["Passwort", c.pass]].filter(([, v]) => !configured(v)).map(([k]) => k as string);
}

/** Server und Benutzer (ohne Passwort) – für Fehlermeldungen beim Test-Versand. */
export async function mailerInfo(): Promise<string> {
  const { host, port, user } = await smtpConfig();
  return `${host ?? "–"}:${port}, Benutzer ${user ?? "–"}`;
}

export async function mailerConfigured(): Promise<boolean> {
  return (await missingMailerVars()).length === 0;
}

function createTransporter(c: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: configured(c.user) ? { user: c.user, pass: c.pass ?? "" } : undefined,
  });
}

async function getTransporter(): Promise<{ t: Transporter; from?: string } | null> {
  const c = await smtpConfig();
  if (!configured(c.host) || !configured(c.user) || !configured(c.pass)) {
    console.warn("[mail] SMTP ist nicht eingerichtet – E-Mail-Benachrichtigungen sind deaktiviert");
    return null;
  }
  return { t: createTransporter(c), from: c.from };
}

/** Prüft Zugangsdaten per SMTP-Verbindung und Anmeldung, ohne eine Mail zu senden. */
export async function verifySmtp(c: SmtpConfig): Promise<void> {
  await createTransporter(c).verify();
}

export type Mail = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: string; contentType: string }[];
};

/** Verschickt eine Mail über SMTP. Gibt false zurück, wenn SMTP nicht eingerichtet ist. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const tr = await getTransporter();
  if (!tr || mail.to.length === 0) return false;
  const members = await db.user.findMany({
    where: { email: { in: mail.to } },
    select: { email: true, username: true, displayName: true, active: true, isPlatformAdmin: true,
      tenant: { select: { slug: true, name: true } } },
  });
  const blockedEmails = new Set(members
    .filter((m) => !m.active || isRestrictedUser(m) || isTenantLocked(m.tenant))
    .map((m) => m.email.toLowerCase()));
  const to = mail.to.filter((address) => !blockedEmails.has(address.toLowerCase()));
  if (to.length === 0) return false;
  await tr.t.sendMail({ from: tr.from, ...mail, to });
  return true;
}

/** Kommagetrennte Liste aus Tenant.leadNotifyEmails. */
export function parseEmailList(value: string): string[] {
  return value.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
