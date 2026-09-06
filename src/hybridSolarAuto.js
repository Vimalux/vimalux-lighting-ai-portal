import { stripMunicipalityPrefix } from "./solarLocation.js";

export function projectMunicipalityName(project = {}) {
  const stored = stripMunicipalityPrefix(project?.assumptions?.hybridSolarLocation?.query || "");
  if (stored) return stored;
  return stripMunicipalityPrefix(project?.customer?.name || "");
}

export function needsAutomaticHybridSolar(project, result) {
  const hybrid = result?.hybridSolar || {};
  if (!project || !hybrid.enabled || Number(hybrid.totalHybridUnits || 0) <= 0) return false;
  if (Number(hybrid.solarYieldKwhPerKwp || 0) > 0) return false;
  if (Number(project?.assumptions?.hybridSolarYieldKwhPerKwp || 0) > 0) return false;
  return Boolean(projectMunicipalityName(project));
}
