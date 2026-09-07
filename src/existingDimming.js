const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const positive = (value) => Math.max(0, numeric(value));
const clampPercent = (value) => Math.max(0, Math.min(100, positive(value)));

export function isNightlyDimmingProfile(group = {}) {
  if (group.existingDimmingProfile !== "fixed" || group.existingDimmingMethod !== "profile") return false;
  const full = positive(group.existingFullPowerHours);
  const reduced = positive(group.existingReducedHours);
  const total = full + reduced;
  // Historic Intelligence expected annual hours. Values that fit inside one day are
  // unambiguously treated as hours per night; annual legacy values remain untouched.
  return total > 0 && total <= 24.5;
}

export function nightlyDimmingMetrics(group = {}, operatingHours = 0) {
  const annualHours = positive(operatingHours);
  const full = positive(group.existingFullPowerHours);
  const reduced = positive(group.existingReducedHours);
  const residualPct = clampPercent(group.existingReducedLoadPercent);
  const reductionDuringReducedPct = 100 - residualPct;
  const totalNightHours = full + reduced;
  const nightly = isNightlyDimmingProfile(group);

  if (!nightly) {
    const annualReducedHours = reduced;
    const annualFullHours = full;
    const annualReductionPct = annualHours > 0
      ? annualReducedHours * reductionDuringReducedPct / annualHours
      : 0;
    return {
      nightly: false,
      fullPowerHoursPerNight: null,
      reducedHoursPerNight: null,
      totalNightHours: null,
      residualPowerPct: residualPct,
      reductionDuringReducedPct,
      annualFullHours,
      annualReducedHours,
      annualReductionPct,
    };
  }

  const reducedShare = totalNightHours > 0 ? reduced / totalNightHours : 0;
  const annualReducedHours = annualHours * reducedShare;
  const annualFullHours = Math.max(0, annualHours - annualReducedHours);
  const annualReductionPct = reducedShare * reductionDuringReducedPct;
  return {
    nightly: true,
    fullPowerHoursPerNight: full,
    reducedHoursPerNight: reduced,
    totalNightHours,
    residualPowerPct: residualPct,
    reductionDuringReducedPct,
    annualFullHours,
    annualReducedHours,
    annualReductionPct,
  };
}

export function normalizeNightlyDimmingProject(project = {}) {
  const operatingHours = positive(project?.assumptions?.operatingHours);
  const groups = (Array.isArray(project?.groups) ? project.groups : []).map((group) => {
    const metrics = nightlyDimmingMetrics(group, operatingHours);
    if (!metrics.nightly) return group;
    return {
      ...group,
      // calculationsBase historically consumes annual full/reduced hours. Convert only
      // for the calculation copy; the stored Business Case keeps the intuitive nightly input.
      existingFullPowerHours: metrics.annualFullHours,
      existingReducedHours: metrics.annualReducedHours,
      nightlyFullPowerHours: metrics.fullPowerHoursPerNight,
      nightlyReducedHours: metrics.reducedHoursPerNight,
      nightlyResidualPowerPct: metrics.residualPowerPct,
      nightlyReductionDuringReducedPct: metrics.reductionDuringReducedPct,
      nightlyAnnualReductionPct: metrics.annualReductionPct,
      existingDimmingInputBasis: "night",
    };
  });
  return { ...project, groups };
}

export function summarizeExistingDimming(project = {}) {
  const operatingHours = positive(project?.assumptions?.operatingHours);
  const active = (Array.isArray(project?.groups) ? project.groups : [])
    .filter((group) => group?.existingDimmingProfile === "fixed")
    .map((group) => ({
      group,
      quantity: positive(group.quantity),
      metrics: group.existingDimmingMethod === "profile"
        ? nightlyDimmingMetrics(group, operatingHours)
        : {
            nightly: false,
            fullPowerHoursPerNight: null,
            reducedHoursPerNight: null,
            residualPowerPct: null,
            reductionDuringReducedPct: null,
            annualReductionPct: clampPercent(group.existingDimmingPercent),
          },
    }));

  const profiles = [];
  for (const item of active) {
    const m = item.metrics;
    const note = String(item.group.existingDimmingNote || "").trim();
    const key = item.group.existingDimmingMethod === "profile"
      ? [m.nightly ? "night" : "annual", m.fullPowerHoursPerNight ?? item.group.existingFullPowerHours, m.reducedHoursPerNight ?? item.group.existingReducedHours, m.residualPowerPct, note].join("|")
      : `average|${m.annualReductionPct}|${note}`;
    const existing = profiles.find((profile) => profile.key === key);
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }
    profiles.push({
      key,
      quantity: item.quantity,
      method: item.group.existingDimmingMethod || "average",
      note,
      ...m,
    });
  }
  return { active: active.length > 0, profiles };
}
