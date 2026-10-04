import { describe, expect, it } from "vitest";
import { evenSplit, largestRemainder, normalize, setShare, toPercents } from "../src/lib/percent-split";

const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
const all = (n: number, value = true) => Array.from({ length: n }, () => value);

describe("Prozent-Verteilung", () => {
  it("verteilt ganze Prozente mit Summe 100", () => {
    expect(largestRemainder([1, 1, 1], 100)).toEqual([34, 33, 33]);
    expect(toPercents([1, 1, 1], all(3))).toEqual([34, 33, 33]);
    expect(toPercents([2, 1, 1], all(3))).toEqual([50, 25, 25]);
  });

  it("ignoriert nicht verfügbare Vertriebler", () => {
    expect(toPercents([1, 1, 1], [true, false, true])).toEqual([50, 0, 50]);
  });

  it("gleicht beim Ändern eines Anteils die anderen anteilig aus", () => {
    const next = setShare([50, 30, 20], all(3), all(3, false), 0, 70);
    expect(next).toEqual([70, 18, 12]);
    expect(sum(next)).toBe(100);
  });

  it("lässt gesperrte Anteile unverändert", () => {
    const next = setShare([40, 30, 30], all(3), [false, true, false], 0, 60);
    expect(next).toEqual([60, 30, 10]);
  });

  it("begrenzt auf das, was die gesperrten übrig lassen", () => {
    expect(setShare([40, 30, 30], all(3), [false, true, true], 0, 90)).toEqual([40, 30, 30]);
    expect(setShare([40, 50, 10], all(3), [false, true, false], 0, 90)).toEqual([50, 50, 0]);
  });

  it("verteilt den Rest gleichmäßig, wenn die anderen auf 0 stehen", () => {
    expect(setShare([100, 0, 0], all(3), all(3, false), 0, 40)).toEqual([40, 30, 30]);
  });

  it("bringt nach dem Pausieren wieder auf 100", () => {
    expect(normalize([50, 25, 25], [true, false, true], all(3, false))).toEqual([67, 0, 33]);
  });

  it("teilt gleichmäßig unter Beachtung gesperrter Anteile", () => {
    expect(evenSplit([70, 20, 10], all(3), all(3, false))).toEqual([34, 33, 33]);
    expect(evenSplit([70, 20, 10], all(3), [true, false, false])).toEqual([70, 15, 15]);
  });
});
