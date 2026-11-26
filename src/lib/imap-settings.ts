import { db } from "./db";
import { decryptSecret } from "./secret-box";

/** Setting-Schlüssel der in der App gespeicherten Postfach-Zugangsdaten (Passwort verschlüsselt). */
export const IMAP_SETTING_KEY = "imap.config";

export type StoredImap = { host: string; port: number; secure: boolean; user: string; pass?: string };

export async function readStoredImap(): Promise<StoredImap | null> {
  const row = await db.setting.findUnique({ where: { key: IMAP_SETTING_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as StoredImap;
  } catch {
    return null;
  }
}

export type ImapSettings = { host?: string; port: number; secure: boolean; user?: string; pass?: string; source: "app" | "env" };

function ok(value: string | undefined): value is string {
  return Boolean(value) && !value!.startsWith("PLATZHALTER");
}

/** Wirksamer Postfach-Zugang: in der App gespeicherte Werte gehen vor den IMAP_*-Variablen des Servers. */
export async function imapSettings(): Promise<ImapSettings> {
  const stored = await readStoredImap();
  if (stored?.host) {
    return { host: stored.host, port: stored.port, secure: stored.secure, user: stored.user, pass: stored.pass ? decryptSecret(stored.pass) ?? undefined : undefined, source: "app" };
  }
  const env = process.env;
  return { host: env.IMAP_HOST?.trim(), port: Number(env.IMAP_PORT || 993), secure: env.IMAP_SECURE !== "false", user: env.IMAP_USER?.trim(), pass: env.IMAP_PASS, source: "env" };
}

export async function imapConfigured(): Promise<boolean> {
  const c = await imapSettings();
  return ok(c.host) && ok(c.user) && Boolean(c.pass);
}
