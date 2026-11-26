import { describe, expect, it } from "vitest";
import { parseKeywords, subjectMatches } from "@/lib/lead-intake";

describe("Lead-Eingang: Betreff-Stichwörter", () => {
  it("liest Komma- und Zeilenlisten ohne Duplikate", () => {
    expect(parseKeywords("Neuer Lead,\n facebook ; NEUER LEAD\n\n")).toEqual(["Neuer Lead", "facebook"]);
    expect(parseKeywords(null)).toEqual([]);
  });
  it("lässt ohne Stichwörter alles durch", () => {
    expect(subjectMatches("irgendwas", [])).toBe(true);
    expect(subjectMatches(null, [])).toBe(true);
  });
  it("erkennt Stichwörter ohne Groß-/Kleinschreibung", () => {
    expect(subjectMatches("Fwd: NEUER LEAD von Facebook", ["neuer lead"])).toBe(true);
    expect(subjectMatches("Newsletter", ["neuer lead", "facebook"])).toBe(false);
    expect(subjectMatches(null, ["neuer lead"])).toBe(false);
  });
});
