/**
 * Rechenhilfen für die Lead-Verteilung in Prozent: Die Anteile aller verfügbaren Vertriebler ergeben
 * immer genau 100 (ganze Zahlen). Ändert man einen Anteil, gleichen die anderen – außer gesperrten –
 * die Differenz anteilig aus.
 */

/** Verteilt total als ganze Zahlen im Verhältnis von raw (Hare-Niemeyer / größter Rest). */
export function largestRemainder(raw: number[], total: number): number[] {
  if (raw.length === 0) return [];
  const sum = raw.reduce((s, v) => s + v, 0);
  const exact = sum > 0 ? raw.map((v) => (v / sum) * total) : raw.map(() => total / raw.length);
  const result = exact.map(Math.floor);
  let left = total - result.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) result[order[k].i]++;
  return result;
}

/** Gewichte → Prozente (Summe 100) für die verfügbaren Zeilen; nicht verfügbare bekommen 0. */
export function toPercents(weights: number[], eligible: boolean[]): number[] {
  const idx = weights.map((_, i) => i).filter((i) => eligible[i]);
  const shares = largestRemainder(idx.map((i) => Math.max(0, weights[i])), 100);
  const out = weights.map(() => 0);
  idx.forEach((i, k) => (out[i] = shares[k]));
  return out;
}

/** Höchstwert, den Zeile index annehmen kann (100 minus gesperrte Anteile der anderen). */
export function maxShare(values: number[], eligible: boolean[], locked: boolean[], index: number): number {
  const lockedSum = values.reduce((s, v, i) => (i !== index && eligible[i] && locked[i] ? s + v : s), 0);
  return Math.max(0, 100 - lockedSum);
}

/**
 * Setzt Zeile index auf target und verteilt den Rest anteilig auf die anderen freien Zeilen.
 * Sind alle anderen frei auf 0, bekommen sie den Rest zu gleichen Teilen.
 */
export function setShare(values: number[], eligible: boolean[], locked: boolean[], index: number, target: number): number[] {
  const free = values.map((_, i) => i).filter((i) => i !== index && eligible[i] && !locked[i]);
  const max = maxShare(values, eligible, locked, index);
  const value = free.length === 0 ? max : Math.min(max, Math.max(0, Math.round(target)));
  const rest = max - value;
  const shares = largestRemainder(free.map((i) => values[i]), rest);
  const out = [...values];
  out[index] = value;
  free.forEach((i, k) => (out[i] = shares[k]));
  return out;
}

/**
 * Bringt die verfügbaren Zeilen wieder auf 100 (z. B. nach Pausieren): freie Zeilen füllen anteilig auf,
 * was die gesperrten übrig lassen. Passt das nicht, werden alle Zeilen gemeinsam skaliert.
 */
export function normalize(values: number[], eligible: boolean[], locked: boolean[]): number[] {
  const out = values.map((v, i) => (eligible[i] ? v : 0));
  const free = out.map((_, i) => i).filter((i) => eligible[i] && !locked[i]);
  const lockedSum = out.reduce((s, v, i) => (eligible[i] && locked[i] ? s + v : s), 0);
  if (free.length > 0 && lockedSum <= 100) {
    const shares = largestRemainder(free.map((i) => out[i]), 100 - lockedSum);
    free.forEach((i, k) => (out[i] = shares[k]));
    return out;
  }
  return toPercents(out, eligible);
}

/** Alle verfügbaren und nicht gesperrten Zeilen teilen sich den freien Rest gleichmäßig. */
export function evenSplit(values: number[], eligible: boolean[], locked: boolean[]): number[] {
  return normalize(
    values.map((v, i) => (eligible[i] && !locked[i] ? 1 : v)),
    eligible,
    locked,
  );
}
