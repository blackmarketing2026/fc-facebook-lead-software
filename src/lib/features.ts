/**
 * Feature-Schalter: Neue Funktionen kommen hier in die Liste und werden im Code mit
 * hasFeature() abgefragt. Der Entwicklungs-Mandant hat automatisch alle aktiv; für alle
 * anderen Mandanten schaltet der Plattform-Admin sie einzeln frei.
 */
export const FEATURES = [
  {
    key: "leads-csv-export",
    label: "CSV-Export der Leads",
    description: "Admins können die gefilterte Lead-Liste als CSV-Datei herunterladen.",
  },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export const FEATURE_KEYS: readonly string[] = FEATURES.map((f) => f.key);

export function hasFeature(tenant: { isDevelopment: boolean; features: string[] }, key: FeatureKey): boolean {
  return tenant.isDevelopment || tenant.features.includes(key);
}
