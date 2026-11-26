/** Erkennung von Rückläufer-Mails (Bounce) und Spam-Beschwerden anhand der Sendungs-ID im Mail-Header. */

export type BounceInfo = { kind: "BOUNCE" | "COMPLAINT"; sendId: string; reason: string | null };

const SEND_ID_RE = /X-FC-Send:\s*([0-9a-fA-F-]{36})/i;

/** Betreff, Absender oder Report-Typ sprechen für eine automatische Rückläufer- bzw. Beschwerde-Mail. */
export function looksLikeBounce(input: { from?: string | null; subject?: string | null; raw: string }): "BOUNCE" | "COMPLAINT" | null {
  const raw = input.raw.slice(0, 200_000);
  if (/report-type=["']?feedback-report/i.test(raw)) return "COMPLAINT";
  if (/report-type=["']?delivery-status/i.test(raw)) return "BOUNCE";
  const from = input.from ?? "";
  const subject = input.subject ?? "";
  if (/mailer-daemon|postmaster/i.test(from)) return "BOUNCE";
  if (/undeliver|delivery status|returned mail|failure notice|delivery failure|nicht zugestellt|unzustellbar|zustellung fehlgeschlagen/i.test(subject)) return "BOUNCE";
  return null;
}

/** Kurzer Grund aus dem Diagnostic-Code bzw. Status der Rückläufer-Mail. */
export function bounceReason(raw: string): string | null {
  const diag = raw.match(/Diagnostic-Code:\s*(?:smtp;\s*)?([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
  if (diag) return diag[1].replace(/\s+/g, " ").trim().slice(0, 300);
  const status = raw.match(/Status:\s*([245]\.\d+\.\d+)/i);
  return status ? `Status ${status[1]}` : null;
}

/** Liefert die Bounce-/Beschwerde-Daten, wenn die Mail eine Rückläufer-Mail zu einer unserer Ketten-Mails ist. */
export function parseBounce(input: { from?: string | null; subject?: string | null; raw: string }): BounceInfo | null {
  const kind = looksLikeBounce(input);
  if (!kind) return null;
  const id = input.raw.match(SEND_ID_RE)?.[1];
  if (!id) return null;
  // Weiche Fehler (4.x.x, z. B. „Postfach voll“ vorübergehend) zählen nicht als endgültiger Bounce.
  const status = input.raw.match(/Status:\s*([245])\.\d+\.\d+/i)?.[1];
  if (kind === "BOUNCE" && status === "4") return null;
  return { kind, sendId: id, reason: bounceReason(input.raw) };
}
