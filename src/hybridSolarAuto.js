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
  const first = parts[0];
  if (!/^(?:test|pilot|progetto|project)\b/i.test(first)) return "";
  return normalizeCandidate(parts.at(-1));
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
