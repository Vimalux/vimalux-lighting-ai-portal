import { stripMunicipalityPrefix } from "./solarLocation.js";

function normalizeCandidate(value) {
  let clean = stripMunicipalityPrefix(value);
  if (!clean) return "";

  // Test/pilot/project wrappers are common in Intelligence project labels but are not
  // valid municipality names for geocoding. Keep the actual municipality suffix.
  clean = clean
    .replace(/^(?:test|pilot|progetto|project)\s*\d*\s*[-–—:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return clean;
}

function municipalitySuffix(value) {
  const clean = stripMunicipalityPrefix(value);
  const parts = clean.split(/\s+[-–—:]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return "";

  // In project/customer labels the right-most segment is normally the municipality,
  // e.g. "CiviSmart – Poggiardo", "Test 1 - Poggiardo" or "Pilot: Serino".
  // Try this suffix first, but keep the full label as a later fallback candidate.
  const suffix = normalizeCandidate(parts.at(-1));
  if (!suffix) return "";

  // Avoid treating obvious non-location workflow/status suffixes as municipalities.
  if (/^(?:step\s*\d|fase\s*\d|phase\s*\d|upgrade|partner|test|pilot)$/i.test(suffix)) return "";
  return suffix;
}

export function projectMunicipalityCandidates(project = {}) {
  const raw = [
    project?.assumptions?.hybridSolarLocation?.query,
    project?.customer?.name,
    project?.project?.name,
    project?.name,
  ];

  const candidates = [];
  const add = (value) => {
    const candidate = normalizeCandidate(value);
    if (!candidate) return;
    if (!candidates.some((existing) => existing.toLowerCase() === candidate.toLowerCase())) candidates.push(candidate);
  };

  raw.forEach((value) => {
    const suffix = municipalitySuffix(value);
    if (suffix) add(suffix);
    add(value);
  });

  return candidates;
}

export function projectMunicipalityName(project = {}) {
  return projectMunicipalityCandidates(project)[0] || "";
}

export function needsAutomaticHybridSolar(project, result) {
  const hybrid = result?.hybridSolar || {};
  if (!project || !hybrid.enabled || Number(hybrid.totalHybridUnits || 0) <= 0) return false;
  if (Number(hybrid.solarYieldKwhPerKwp || 0) > 0) return false;
  if (Number(project?.assumptions?.hybridSolarYieldKwhPerKwp || 0) > 0) return false;
  return projectMunicipalityCandidates(project).length > 0;
}
