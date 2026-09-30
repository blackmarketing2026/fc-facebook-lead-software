import type { Prisma } from "@prisma/client";

export type DistCandidate = {
  id: string;
  distOrder: number;
  distWeight: number;
  distCurrent: number;
};

/**
 * Smooth Weighted Round-Robin (wie nginx): jeder Kandidat bekommt sein Gewicht
 * gutgeschrieben, der mit dem höchsten Zähler gewinnt und gibt die Gewichtssumme ab.
 * Ergebnis: Leads werden proportional zum Gewicht und gleichmäßig gestreut verteilt.
 */
export function pickNext(candidates: DistCandidate[]): {
  winnerId: string | null;
  updated: DistCandidate[];
} {
  const pool = candidates
    .filter((c) => c.distWeight > 0)
    .sort((a, b) => a.distOrder - b.distOrder)
    .map((c) => ({ ...c }));
  if (pool.length === 0) return { winnerId: null, updated: [] };

  const total = pool.reduce((sum, c) => sum + c.distWeight, 0);
  let winner = pool[0];
  for (const c of pool) {
    c.distCurrent += c.distWeight;
    if (c.distCurrent > winner.distCurrent) winner = c;
  }
  // Bei Gleichstand gewinnt der Erste in der Reihenfolge; das stellt die Schleife
  // oben schon sicher, weil nur ein strikt größerer Zähler den Gewinner ersetzt.
  winner.distCurrent -= total;
  return { winnerId: winner.id, updated: pool };
}

/** Simuliert die nächsten n Zuweisungen, ohne etwas zu speichern (Vorschau). */
export function previewSequence(candidates: DistCandidate[], n: number): string[] {
  let state = candidates;
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const { winnerId, updated } = pickNext(state);
    if (!winnerId) break;
    result.push(winnerId);
    state = updated;
  }
  return result;
}

/**
 * Wählt in einer laufenden Transaktion den nächsten Vertriebler und speichert die Zähler.
 * Die Zeilen werden mit FOR UPDATE gesperrt, damit parallele Leads sich nicht überschneiden.
 */
export async function assignNextSalesUser(tx: Prisma.TransactionClient): Promise<string | null> {
  const rows = await tx.$queryRaw<DistCandidate[]>`
    SELECT id, "distOrder", "distWeight", "distCurrent"
    FROM "User"
    WHERE role = 'SALES' AND active = true AND "distPaused" = false
    ORDER BY "distOrder" ASC
    FOR UPDATE`;
  const { winnerId, updated } = pickNext(rows);
  for (const c of updated) {
    await tx.user.update({ where: { id: c.id }, data: { distCurrent: c.distCurrent } });
  }
  return winnerId;
}
