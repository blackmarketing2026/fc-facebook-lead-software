import { describe, expect, it } from "vitest";
import { isRestrictedUser, isRestrictedTenant } from "@/lib/access-lock";
describe("Zugriffssperre", () => {
  it.each(["martin", "selina", "frances", "francis"])("sperrt %s", (username) => {
    expect(isRestrictedUser({ username, displayName: "Test" })).toBe(true);
  });
  it.each(["Martin Engel", "Selina Muster", "Frances", "Francis"])("erkennt den Anzeigenamen %s", (displayName) => {
    expect(isRestrictedUser({ username: "generiert", displayName })).toBe(true);
  });
  it("erhält den Master-Zugang", () => {
    expect(isRestrictedUser({ username: "martin", displayName: "Martin", isPlatformAdmin: true })).toBe(false);
  });
  it.each([{ slug: "engel", name: "Engel" }, { slug: "schutz-mit-engel", name: "Versicherung" }, { slug: "guido", name: "Guido Plattform" }, { slug: "x", name: "Engels Plattform" }])("sperrt den Mandanten %s", (tenant) => {
    expect(isRestrictedTenant(tenant)).toBe(true);
  });
  it("lässt fremde Mandanten aktiv", () => {
    expect(isRestrictedTenant({ slug: "function-concept", name: "Function Concept" })).toBe(false);
    expect(isRestrictedTenant({ slug: "dev", name: "Entwicklung" })).toBe(false);
  });
});
