import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function configured(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("PLATZHALTER");
}

/** SMTP-Zugang für den Versand – ausschließlich aus den SMTP_*-Variablen. */
function smtpConfig() {
  const env = process.env;
  const user = env.SMTP_USER;
  const from = configured(env.SMTP_FROM) ? env.SMTP_FROM : user;
  return { host: env.SMTP_HOST, user, pass: env.SMTP_PASS, from };
}

/** Pflicht-Variablen, die auf dem Server fehlen (für Hinweise in den Einstellungen). */
export function missingMailerVars(): string[] {
  return (["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const).filter((key) => !configured(process.env[key]));
}

/** Server und Benutzer (ohne Passwort) – für Fehlermeldungen beim Test-Versand. */
export function mailerInfo(): string {
  const { host, user } = smtpConfig();
  return `SMTP_HOST ${host ?? "–"}, SMTP_USER ${user ?? "–"}`;
}

export function mailerConfigured(): boolean {
  return missingMailerVars().length === 0;
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!mailerConfigured()) {
    console.warn("[mail] SMTP ist nicht eingerichtet – E-Mail-Benachrichtigungen sind deaktiviert");
    transporter = null;
    return null;
  }
  const { host, user, pass } = smtpConfig();
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: configured(user) ? { user, pass: pass ?? "" } : undefined,
  });
  return transporter;
}

export type Mail = { to: string[]; subject: string; text: string; html: string };

/** Verschickt eine Mail über SMTP. Gibt false zurück, wenn SMTP nicht eingerichtet ist. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = getTransporter();
  if (!t || mail.to.length === 0) return false;
  await t.sendMail({ from: smtpConfig().from, ...mail });
  return true;
}

/** Kommagetrennte Liste aus Tenant.leadNotifyEmails. */
export function parseEmailList(value: string): string[] {
  return value.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
