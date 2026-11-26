import { beforeEach, describe, expect, it } from "vitest";
import { describeWait, renderTemplate, textToHtml, unsubscribeToken, validWait, varsForLead, verifyUnsubscribe, waitMs } from "@/lib/chain-logic";

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

  it("erzeugt und prüft Abmelde-Token pro Lead", () => {
    const token = unsubscribeToken("lead-1");
    expect(verifyUnsubscribe("lead-1", token)).toBe(true);
    expect(verifyUnsubscribe("lead-2", token)).toBe(false);
    expect(verifyUnsubscribe("lead-1", "falsch")).toBe(false);
  });
});
