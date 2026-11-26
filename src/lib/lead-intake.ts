import { db } from "./db";

/** Setting-Schlüssel: Stichwörter, von denen eines im Betreff einer Lead-Mail stehen muss. */
export const SUBJECT_KEYWORDS_KEY = "lead.subjectKeywords";

/** Stichwörter aus Komma- oder Zeilenliste (ohne Duplikate und Leerzeilen). */
export function parseKeywords(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? "").split(/[\n,;]+/).map((k) => k.trim()).filter((k) => {
    const key = k.toLowerCase();
    if (!k || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Ohne Stichwörter wird jede Mail geprüft; sonst muss der Betreff mindestens eines enthalten (ohne Groß-/Kleinschreibung). */
export function subjectMatches(subject: string | null | undefined, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const s = (subject ?? "").toLowerCase();
  return keywords.some((k) => s.includes(k.toLowerCase()));
}

/** Setting-Schlüssel: Stichwörter, von denen eines in den Empfängeradressen stehen muss (An/Cc/Weiterleitung). */
export const RECIPIENT_KEYWORDS_KEY = "lead.recipientKeywords";

export async function getSubjectKeywords(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: SUBJECT_KEYWORDS_KEY } });
  return parseKeywords(row?.value);
}

export async function getRecipientKeywords(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: RECIPIENT_KEYWORDS_KEY } });
  return parseKeywords(row?.value);
}

/** Prüft eine Mail gegen beide Bedingungen; null = passt, sonst der Grund für die Ablehnung. */
export async function intakeRejection(mail: { subject?: string | null; to?: string | null }): Promise<string | null> {
  const [subject, recipient] = await Promise.all([getSubjectKeywords(), getRecipientKeywords()]);
  if (!subjectMatches(mail.subject, subject)) return "Der Betreff enthält keines der eingestellten Stichwörter (Einstellungen → Lead-Empfang).";
  if (!subjectMatches(mail.to, recipient)) return "Die Mail wurde nicht an eine der eingestellten Empfängeradressen gesendet (Einstellungen → Lead-Empfang).";
  return null;
}
