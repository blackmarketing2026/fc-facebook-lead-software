import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function configured(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("PLATZHALTER");
}

/** SMTP-Zugang; ohne eigene SMTP_*-Variablen wird das Lead-Postfach (IMAP_*) mitbenutzt – bei All-Inkl derselbe Server. */
function smtpConfig() {
  const env = process.env;
  const host = configured(env.SMTP_HOST) ? env.SMTP_HOST : env.IMAP_HOST;
  const user = configured(env.SMTP_USER) ? env.SMTP_USER : env.IMAP_USER;
  const pass = configured(env.SMTP_PASS) ? env.SMTP_PASS : env.IMAP_PASS;
  const from = configured(env.SMTP_FROM) ? env.SMTP_FROM : user;
  return { host, user, pass, from };
}

/** Server und Benutzer (ohne Passwort) – für Fehlermeldungen beim Test-Versand. */
export function mailerInfo(): string {
  const { host, user } = smtpConfig();
  const env = process.env;
  const hostVar = configured(env.SMTP_HOST) ? "SMTP_HOST" : "IMAP_HOST";
  const userVar = configured(env.SMTP_USER) ? "SMTP_USER" : "IMAP_USER";
  const passVar = configured(env.SMTP_PASS) ? "SMTP_PASS" : "IMAP_PASS";
  return `Server ${host ?? "–"} aus ${hostVar}, Benutzer ${user ?? "–"} aus ${userVar}, Passwort aus ${passVar}`;
}

export function mailerConfigured(): boolean {
  const { host, from } = smtpConfig();
  return configured(host) && configured(from);
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
