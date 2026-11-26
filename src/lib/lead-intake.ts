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

export async function getSubjectKeywords(): Promise<string[]> {
  const row = await db.setting.findUnique({ where: { key: SUBJECT_KEYWORDS_KEY } });
  return parseKeywords(row?.value);
}
