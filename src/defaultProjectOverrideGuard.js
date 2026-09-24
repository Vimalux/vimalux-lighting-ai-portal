export const DEFAULT_ASSUMPTIONS_STORAGE_KEY = "vimalux-intelligence-default-assumptions";
export const NON_INHERITABLE_PROJECT_OVERRIDES = [
  "allInclusiveAnnualPayment",
  "officialOfferCapex",
  "officialAnnualOpex",
];

export function sanitizeStoredDefaultOverrides(storage = globalThis?.localStorage) {
  if (!storage?.getItem || !storage?.setItem) return false;
  try {
    const raw = storage.getItem(DEFAULT_ASSUMPTIONS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const container = parsed?.values && typeof parsed.values === "object" ? parsed.values : parsed;
    if (!container || typeof container !== "object" || Array.isArray(container)) return false;

    let changed = false;
    const cleaned = { ...container };
    for (const key of NON_INHERITABLE_PROJECT_OVERRIDES) {
      if (Object.prototype.hasOwnProperty.call(cleaned, key)) {
        delete cleaned[key];
        changed = true;
      }
    }
    if (!changed) return false;

    const next = parsed?.values && typeof parsed.values === "object"
      ? { ...parsed, values: cleaned }
      : cleaned;
    storage.setItem(DEFAULT_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") sanitizeStoredDefaultOverrides(window.localStorage);
