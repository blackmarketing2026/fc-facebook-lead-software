import { describe, expect, it } from "vitest";
import { normalizePhone, parseContactForm, parseTagList } from "@/lib/contact-input";

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("Kontakt anlegen: Eingaben", () => {
  it("normalisiert Telefonnummern", () => {
    expect(normalizePhone("+49 (176) 2160-1619")).toBe("+4917621601619");
  });

  it("liest Tags ohne Duplikate", () => {
    expect(parseTagList("Neuer Lead, google ads;  GOOGLE ADS\n\nVIP")).toEqual(["Neuer Lead", "google ads", "VIP"]);
  });

  it("verlangt mindestens Name, E-Mail oder Telefon", () => {
    expect(parseContactForm(form({}))).toMatchObject({ ok: false });
    expect(parseContactForm(form({ fullName: "Max" }))).toMatchObject({ ok: true });
  });

  it("prüft E-Mail und Telefon", () => {
    expect(parseContactForm(form({ email: "kein-mail" }))).toMatchObject({ ok: false, error: "Ungültige E-Mail-Adresse." });
    expect(parseContactForm(form({ phone: "abc" }))).toMatchObject({ ok: false });
    const ok = parseContactForm(form({ fullName: " Max Mustermann ", email: " MAX@Example.com ", phone: "+49 170 1234567", consent: "on", tags: "A, B" }));
    expect(ok).toMatchObject({ ok: true, data: { fullName: "Max Mustermann", email: "max@example.com", phone: "+491701234567", consent: true, tags: ["A", "B"] } });
  });
});
