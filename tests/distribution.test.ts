import { describe, expect, it } from "vitest";
import { pickNext, previewSequence, type DistCandidate } from "@/lib/distribution";

const users = (w: [number, number, number]): DistCandidate[] => [
  { id: "martin", distOrder: 0, distWeight: w[0], distCurrent: 0 },
  { id: "selina", distOrder: 1, distWeight: w[1], distCurrent: 0 },
  { id: "frances", distOrder: 2, distWeight: w[2], distCurrent: 0 },
];

function count(seq: string[]) {
  return seq.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});
}

describe("Verteilung", () => {
  it("rotiert bei gleichem Gewicht strikt in der Reihenfolge", () => {
    expect(previewSequence(users([1, 1, 1]), 6)).toEqual(["martin", "selina", "frances", "martin", "selina", "frances"]);
  });

  it("respektiert die Reihenfolge", () => {
    const u = users([1, 1, 1]);
    u[2].distOrder = -1;
    expect(previewSequence(u, 3)).toEqual(["frances", "martin", "selina"]);
  });

  it("verteilt 400 Leads bei 2/1/1 exakt 200/100/100", () => {
    expect(count(previewSequence(users([2, 1, 1]), 400))).toEqual({ martin: 200, selina: 100, frances: 100 });
  });

  it("streut gewichtete Leads statt Blöcke zu bilden", () => {
    expect(previewSequence(users([2, 1, 1]), 8)).toEqual([
      "martin", "selina", "frances", "martin", "martin", "selina", "frances", "martin",
    ]);
  });

  it("überspringt Gewicht 0 und leere Listen", () => {
    expect(count(previewSequence(users([1, 0, 1]), 10))).toEqual({ martin: 5, frances: 5 });
    expect(pickNext([]).winnerId).toBeNull();
  });
});
