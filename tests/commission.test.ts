import { describe, expect, it } from "vitest";
import { parseEuroAmount, parsePeriod, recentPeriods } from "../src/lib/commission";

describe("parseEuroAmount", () => {
  it("liest deutsche und englische Schreibweisen", () => {
    expect(parseEuroAmount("1500")).toBe(1500);
    expect(parseEuroAmount("1.500")).toBe(1500);
    expect(parseEuroAmount("1.500,50 €")).toBe(1500.5);
    expect(parseEuroAmount("1500,5")).toBe(1500.5);
    expect(parseEuroAmount("1500.25")).toBe(1500.25);
    expect(parseEuroAmount("0")).toBe(0);
  });

  it("lehnt Ungültiges ab", () => {
    expect(parseEuroAmount("")).toBeNull();
    expect(parseEuroAmount("abc")).toBeNull();
    expect(parseEuroAmount("-5")).toBeNull();
    expect(parseEuroAmount("1,234")).toBeNull();
  });
});

describe("Zeiträume", () => {
  it("Monat beginnt um Mitternacht Berliner Zeit", () => {
    const p = parsePeriod("month", "2026-10")!;
    expect(p.from.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(p.label).toBe("Oktober 2026");
  });

  it("ISO-Kalenderwochen", () => {
    const p = parsePeriod("week", "2026-W42")!;
    expect(p.from.toISOString()).toBe("2026-10-11T22:00:00.000Z"); // Montag, 12.10.
    expect(p.label).toBe("KW 42/2026 (12.10.–18.10.)");
    expect(parsePeriod("week", "2026-W54")).toBeNull();
    expect(parsePeriod("week", "2021-W01")!.label).toBe("KW 1/2021 (04.01.–10.01.)");
  });

  it("listet die aktuellen Zeiträume zuerst", () => {
    const now = new Date("2026-01-05T10:00:00Z");
    expect(recentPeriods("month", now, 2).map((p) => p.key)).toEqual(["2026-01", "2025-12"]);
    expect(recentPeriods("week", now, 2).map((p) => p.key)).toEqual(["2026-W02", "2026-W01"]);
  });
});
