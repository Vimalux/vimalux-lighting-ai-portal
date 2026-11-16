// The active platform defaults live only in memory. The authoritative copy is
// loaded from Supabase after authentication; no browser storage is consulted.
let current = null;

export function setSharedDefaultState(record) {
  if (!record || !record.values || typeof record.values !== "object" || Array.isArray(record.values)) {
    throw new Error("Invalid global Intelligence defaults response");
  }
  if (!Number.isInteger(Number(record.revision)) || Number(record.revision) < 1) {
    throw new Error("Global Intelligence defaults revision is missing");
  }
  current = { values: { ...record.values }, revision: Number(record.revision) };
  return getSharedDefaultState();
}

export function getSharedDefaultState() {
  return current ? { values: { ...current.values }, revision: current.revision } : null;
}

export function clearSharedDefaultState() { current = null; }
