import { z } from "zod";

export type ContactInput = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  tags: string[];
  note: string | null;
  stageId: string | null;
  consent: boolean;
};

const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Telefonnummer ohne Leerzeichen, Klammern und Bindestriche (wie bei den importierten Facebook-Leads). */
export function normalizePhone(value: string): string {
  return value.replace(/[\s()\-/.]/g, "");
}

/** Tags aus Komma-, Semikolon- oder Zeilenliste ohne Duplikate (ohne Groß-/Kleinschreibung), je max. 80 Zeichen. */
export function parseTagList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[\n,;]+/)) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 80);
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

/** Prüft die Eingaben des „Kontakt anlegen“-Formulars. */
export function parseContactForm(formData: FormData): { ok: true; data: ContactInput } | { ok: false; error: string } {
  const fullName = clean(formData.get("fullName"));
  const email = clean(formData.get("email")).toLowerCase();
  const phone = normalizePhone(clean(formData.get("phone")));
  if (!fullName && !email && !phone) return { ok: false, error: "Bitte mindestens Name, E-Mail oder Telefon angeben." };
  if (fullName.length > 200) return { ok: false, error: "Der Name ist zu lang (max. 200 Zeichen)." };
  if (email && !z.email().safeParse(email).success) return { ok: false, error: "Ungültige E-Mail-Adresse." };
  if (phone && !/^\+?\d{5,20}$/.test(phone)) return { ok: false, error: "Ungültige Telefonnummer (nur Ziffern, optional mit + am Anfang)." };
  const tags = parseTagList(clean(formData.get("tags")));
  if (tags.length > 20) return { ok: false, error: "Höchstens 20 Tags." };
  const note = clean(formData.get("note"));
  if (note.length > 5000) return { ok: false, error: "Die Notiz ist zu lang (max. 5000 Zeichen)." };
  const language = clean(formData.get("language")).slice(0, 40);
  return {
    ok: true,
    data: {
      fullName: fullName || null,
      email: email || null,
      phone: phone || null,
      language: language || null,
      tags,
      note: note || null,
      stageId: clean(formData.get("stageId")) || null,
      consent: formData.get("consent") === "on",
    },
  };
}
