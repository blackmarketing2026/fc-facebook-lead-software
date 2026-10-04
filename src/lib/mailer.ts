import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function configured(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("PLATZHALTER");
}

export function mailerConfigured(): boolean {
  return configured(process.env.SMTP_HOST) && configured(process.env.SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!mailerConfigured()) {
    console.warn("[mail] SMTP ist nicht eingerichtet – E-Mail-Benachrichtigungen sind deaktiviert");
    transporter = null;
    return null;
  }
  const user = process.env.SMTP_USER;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: configured(user) ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  return transporter;
}

export type Mail = { to: string[]; subject: string; text: string; html: string };

/** Verschickt eine Mail über SMTP. Gibt false zurück, wenn SMTP nicht eingerichtet ist. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = getTransporter();
  if (!t || mail.to.length === 0) return false;
  await t.sendMail({ from: process.env.SMTP_FROM, ...mail });
  return true;
}

/** Kommagetrennte Liste aus Tenant.leadNotifyEmails. */
export function parseEmailList(value: string): string[] {
  return value.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
