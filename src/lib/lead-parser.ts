export type ParsedAnswer = {
  position: number;
  questionKey: string;
  questionLabel: string;
  answers: string[];
};

export type ParsedLead = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  answers: ParsedAnswer[];
  raw: unknown;
};

export type ParseResult =
  | { ok: true; lead: ParsedLead }
  | { ok: false; error: string };

// Schlüssel aus dem Formular, die direkt auf Lead-Felder gemappt werden.
const FIELD_KEYS = {
  fullName: ["full_name", "name", "vollständiger_name"],
  email: ["email", "e-mail", "e_mail"],
  phone: ["phone_number", "phone", "telefon", "telefonnummer"],
  language: ["sprache", "language"],
} as const;

const CONTACT_KEYS = new Set<string>([...FIELD_KEYS.fullName, ...FIELD_KEYS.email, ...FIELD_KEYS.phone]);

/** Name, E-Mail und Telefon – werden im Lead-Kopf angezeigt, nicht bei den Formular-Antworten. */
export function isContactKey(questionKey: string): boolean {
  return CONTACT_KEYS.has(questionKey.toLowerCase());
}

/** "welche_bausteine_benötigst_du?" -> "Welche bausteine benötigst du?" */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Sucht das erste JSON-Array im Text, das sich parsen lässt. */
function extractJsonArray(text: string): unknown[] | null {
  let start = text.indexOf("[");
  while (start !== -1) {
    // Vom letzten "]" rückwärts probieren, bis ein gültiges Array herauskommt.
    let end = text.lastIndexOf("]");
    while (end > start) {
      try {
        const value = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(value)) return value;
      } catch {
        // weiter verkürzen
      }
      end = text.lastIndexOf("]", end - 1);
    }
    start = text.indexOf("[", start + 1);
  }
  return null;
}

function findField(answers: ParsedAnswer[], keys: readonly string[]): string | null {
  const hit = answers.find((a) => keys.includes(a.questionKey.toLowerCase()));
  const value = hit?.answers.find((v) => v.trim() !== "");
  return value?.trim() ?? null;
}

export function parseLeadText(text: string, html?: string | null): ParseResult {
  let items = extractJsonArray(text ?? "");
  if (!items && html) items = extractJsonArray(stripHtml(html));
  if (!items) return { ok: false, error: "Kein JSON-Array im E-Mail-Text gefunden" };

  const answers: ParsedAnswer[] = [];
  for (const item of items) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { name?: unknown }).name !== "string"
    ) {
      return { ok: false, error: "JSON-Array hat nicht das Format [{name, values}]" };
    }
    const { name, values } = item as { name: string; values?: unknown };
    const list = Array.isArray(values) ? values.map((v) => String(v)) : values != null ? [String(values)] : [];
    answers.push({
      position: answers.length,
      questionKey: name,
      questionLabel: humanize(name),
      answers: list,
    });
  }
  if (answers.length === 0) return { ok: false, error: "JSON-Array ist leer" };

  const fullName = findField(answers, FIELD_KEYS.fullName);
  const email = findField(answers, FIELD_KEYS.email);
  const phone = findField(answers, FIELD_KEYS.phone);
  const language = findField(answers, FIELD_KEYS.language);

  // Kontaktfelder bleiben im Original, alle anderen Antworten werden lesbar gemacht.
  for (const a of answers) {
    if (!isContactKey(a.questionKey)) a.answers = a.answers.map(humanize);
  }

  if (!fullName && !email && !phone) {
    return { ok: false, error: "Weder Name, E-Mail noch Telefonnummer im Lead gefunden" };
  }

  return { ok: true, lead: { fullName, email, phone, language, answers, raw: items } };
}
