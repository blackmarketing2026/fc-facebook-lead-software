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

/** Setzt die Rotation zurück und lässt optional genau eine gewählte Person zuerst dran sein.
 * Nach dieser ersten Zuweisung stehen alle Zähler wieder auf null; die Gewichte gelten unverändert weiter.
 */
export function rotationStartState(candidates: DistCandidate[], firstId: string | null): DistCandidate[] {
  const eligible = candidates.filter((c) => c.distWeight > 0);
  if (firstId && !eligible.some((c) => c.id === firstId)) throw new Error("Startperson ist nicht in der Rotation.");
  const total = eligible.reduce((sum, c) => sum + c.distWeight, 0);
  return candidates.map((c) => ({
    ...c,
    distCurrent: firstId && c.distWeight > 0 ? (c.id === firstId ? total - c.distWeight : -c.distWeight) : 0,
  }));
}

/**
 * Wählt in einer laufenden Transaktion den nächsten Vertriebler des Mandanten und speichert die Zähler.
 * Die Zeilen werden mit FOR UPDATE gesperrt, damit parallele Leads sich nicht überschneiden.
 */
export async function assignNextSalesUser(tx: Prisma.TransactionClient, tenantId: string): Promise<string | null> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { distributionPaused: true } });
  if (tenant?.distributionPaused) return null;
  const rows = await tx.$queryRaw<DistCandidate[]>`
    SELECT id, distOrder, distWeight, distCurrent
    FROM User
    WHERE tenantId = ${tenantId} AND (role = 'SALES' OR (role = 'ADMIN' AND salesEnabled = true)) AND active = true AND distPaused = false
    ORDER BY distOrder ASC
    FOR UPDATE`;
  const { winnerId, updated } = pickNext(rows);
  for (const c of updated) {
    await tx.user.update({ where: { id: c.id }, data: { distCurrent: c.distCurrent } });
  }
  return winnerId;
}
