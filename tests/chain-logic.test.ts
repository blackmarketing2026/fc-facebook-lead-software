import { beforeEach, describe, expect, it } from "vitest";
import { describeWait, linksToPlainText, renderTemplate, rewriteLinks, textToHtml, unsubscribeToken, validWait, varsForLead, verifyUnsubscribe, waitMs } from "@/lib/chain-logic";
import { hasEmailBody, renderRichEmail } from "@/lib/rich-email";

describe("E-Mail-Kette: Logik", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "s".repeat(40);
  });

  it("rechnet Wartezeiten um und prüft sie", () => {
    expect(waitMs(2, "DAYS")).toBe(2 * 86_400_000);
    expect(waitMs(30, "MINUTES")).toBe(1_800_000);
    expect(validWait(1, "MINUTES")).toBe(true);
    expect(validWait(0, "DAYS")).toBe(false);
    expect(validWait(366, "DAYS")).toBe(false);
    expect(validWait(1.5, "HOURS")).toBe(false);
  });

  it("beschreibt Wartezeiten", () => {
    expect(describeWait(1, "DAYS")).toBe("1 Tag");
    expect(describeWait(3, "HOURS")).toBe("3 Stunden");
  });

  it("ersetzt Platzhalter und entfernt unbekannte", () => {
    const vars = varsForLead({ fullName: "Max Mustermann", email: "max@example.com" });
    expect(renderTemplate("Hallo {{vorname}}, ({{ name }}) {{email}} {{unbekannt}}!", vars)).toBe("Hallo Max, (Max Mustermann) max@example.com !");
    expect(renderTemplate("Hi {{vorname}}", varsForLead({ fullName: null, email: null }))).toBe("Hi ");
  });

  it("wandelt Text in sicheres HTML mit Links", () => {
    const html = textToHtml("Hallo <b>Welt</b>\nZeile 2\n\nSiehe https://example.com/a?b=1");
    expect(html).toContain("&lt;b&gt;Welt&lt;/b&gt;");
    expect(html).toContain("<br>Zeile 2");
    expect(html).toContain('<a href="https://example.com/a?b=1">');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("rendert verlinkten Text sicher und erhält das Ziel für Textversion und Tracking", () => {
    const body = "Besuche [<unser Angebot>](https://example.com/?a=1&b=2) und https://example.org";
    const html = textToHtml(body);
    expect(html).toContain('<a href="https://example.com/?a=1&amp;b=2">&lt;unser Angebot&gt;</a>');
    expect(html).toContain('<a href="https://example.org">https://example.org</a>');
    expect(linksToPlainText(body)).toContain("<unser Angebot> (https://example.com/?a=1&b=2)");
    expect(rewriteLinks(html, (url) => `https://tracking.example/?url=${encodeURIComponent(url)}`)).toContain(encodeURIComponent("https://example.com/?a=1&b=2"));
    expect(textToHtml('[Klick](javascript:alert(1))')).not.toContain('<a href="javascript:');
  });

  it("übernimmt Formatierung und Links sicher in HTML- und Textversion", () => {
    const result = renderRichEmail('<p><strong>Hallo {{vorname}}</strong> <span style="font-size: 24px">Groß</span> <a href="https://example.com">Angebot</a><script>alert(1)</script><a href="javascript:alert(1)">X</a></p>', { vorname: "<img src=x>", name: "", email: "" });
    expect(result.html).toContain('<strong>Hallo &lt;img src=x&gt;</strong>');
    expect(result.html).toContain('font-size:24px');
    expect(result.html).toContain('<a href="https://example.com">Angebot</a>');
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("<script");
    expect(result.text).toContain("https://example.com");
    expect(hasEmailBody("<!-- rich-email --><p></p>")).toBe(false);
    expect(hasEmailBody("<!-- rich-email --><p>Hallo</p>")).toBe(true);
  });

  it("erhält Bilder und GIFs in E-Mails und entfernt unsichere Bildquellen", () => {
    const gif = '<img src="https://example.com/animation.gif" alt="Animation">';
    const result = renderRichEmail(gif, { vorname: "", name: "", email: "" });
    expect(result.html).toContain('src="https://example.com/animation.gif"');
    expect(result.html).toContain("max-width:100%");
    expect(hasEmailBody(`<!-- rich-email -->${gif}`)).toBe(true);
    expect(renderRichEmail('<img src="javascript:alert(1)">', { vorname: "", name: "", email: "" }).html).not.toContain("javascript:");
  });

  it("erzeugt und prüft Abmelde-Token pro Lead", () => {
    const token = unsubscribeToken("lead-1");
    expect(verifyUnsubscribe("lead-1", token)).toBe(true);
    expect(verifyUnsubscribe("lead-2", token)).toBe(false);
    expect(verifyUnsubscribe("lead-1", "falsch")).toBe(false);
  });
});

import { waitTarget } from "@/lib/chain-logic";

describe("Wartezeit mit Uhrzeit (Berlin)", () => {
  const iso = (d: Date) => d.toISOString();

  it("zählt Kalendertage: 8:01 Uhr + 1 Tag + 08:00 Uhr = nächster Tag 8:00 (nicht übermorgen)", () => {
    // 27.11.2026 08:01 Berlin (CET) = 07:01 UTC
    expect(iso(waitTarget(new Date("2026-11-27T07:01:00Z"), 1, "DAYS", "08:00"))).toBe("2026-11-28T07:00:00.000Z");
  });

  it("gilt auch bei später Tageszeit: 15:00 Uhr + 1 Tag + 08:00 Uhr = nächster Tag 8:00", () => {
    expect(iso(waitTarget(new Date("2026-11-27T14:00:00Z"), 1, "DAYS", "08:00"))).toBe("2026-11-28T07:00:00.000Z");
  });

  it("0 Tage: heute zur Uhrzeit, sonst morgen", () => {
    expect(iso(waitTarget(new Date("2026-11-27T05:00:00Z"), 0, "DAYS", "08:00"))).toBe("2026-11-27T07:00:00.000Z");
    expect(iso(waitTarget(new Date("2026-11-27T07:01:00Z"), 0, "DAYS", "08:00"))).toBe("2026-11-28T07:00:00.000Z");
  });

  it("berücksichtigt die Sommerzeit-Umstellung", () => {
    // 28.03.2026 11:00 Berlin (CET); am 29.03. beginnt die Sommerzeit: 08:00 CEST = 06:00 UTC
    expect(iso(waitTarget(new Date("2026-03-28T10:00:00Z"), 1, "DAYS", "08:00"))).toBe("2026-03-29T06:00:00.000Z");
  });

  it("ohne Uhrzeit oder bei Stunden: Dauer ab jetzt", () => {
    const now = new Date("2026-11-27T07:01:00Z");
    expect(iso(waitTarget(now, 2, "DAYS"))).toBe("2026-11-29T07:01:00.000Z");
    expect(iso(waitTarget(now, 3, "HOURS", "08:00"))).toBe("2026-11-27T10:01:00.000Z");
  });

  it("prüft Wartezeiten mit Uhrzeit", () => {
    expect(validWait(0, "DAYS", "08:00")).toBe(true);
    expect(validWait(1, "HOURS", "08:00")).toBe(false);
    expect(validWait(1, "DAYS", "25:00")).toBe(false);
    expect(validWait(0, "DAYS")).toBe(false);
    expect(describeWait(1, "DAYS", "08:00")).toBe("1 Tag, dann um 08:00 Uhr");
  });
});
