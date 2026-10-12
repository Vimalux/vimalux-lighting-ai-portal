const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function advisorPreviousPeriods(project) {
  const saved = project?.assumptions?.financingAdvisorPrevious;
  return saved && typeof saved === "object" ? saved : null;
}

export function applyAdvisorDuration(project, durationYears, mode) {
  const duration = Math.max(1, Math.round(n(durationYears, 1)));
  const assumptions = { ...(project?.assumptions || {}) };
  if (!advisorPreviousPeriods(project)) {
    assumptions.financingAdvisorPrevious = {
      financingPeriod: n(assumptions.financingPeriod, 1),
      financingYears: n(assumptions.financingYears, n(assumptions.financingPeriod, 1)),
      serviceAgreementPeriod: n(assumptions.serviceAgreementPeriod, 1),
      contractYears: n(assumptions.contractYears, n(assumptions.serviceAgreementPeriod, 1)),
      analysisPeriod: n(assumptions.analysisPeriod, n(assumptions.serviceAgreementPeriod, 1)),
      powerAidServicePeriod: n(assumptions.powerAidServicePeriod, 1),
    };
  }

  assumptions.financingPeriod = duration;
  assumptions.financingYears = duration;
  if (mode === "noleggio_operativo") {
    assumptions.serviceAgreementPeriod = duration;
    assumptions.contractYears = duration;
    assumptions.analysisPeriod = duration;
    if (project?.solution?.powerAidEnabled) assumptions.powerAidServicePeriod = duration;
  }

  return { ...project, assumptions };
}

export function restoreAdvisorDuration(project) {
  const previous = advisorPreviousPeriods(project);
  if (!previous) return project;
  const { financingAdvisorPrevious, ...rest } = project.assumptions || {};
  return {
    ...project,
    assumptions: {
      ...rest,
      financingPeriod: previous.financingPeriod,
      financingYears: previous.financingYears,
      serviceAgreementPeriod: previous.serviceAgreementPeriod,
      contractYears: previous.contractYears,
      analysisPeriod: previous.analysisPeriod,
      powerAidServicePeriod: previous.powerAidServicePeriod,
    },
  };
}
