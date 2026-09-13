const positiveYears = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : fallback;
};

/**
 * Customer-facing reports must describe the period that is actually contracted.
 * Keep the underlying Business Case calculation unchanged and create a rendering-only
 * view capped to the CMS/service agreement term.
 */
export function contractReportResult(calculated = {}) {
  const serviceYears = positiveYears(
    calculated.serviceAgreementPeriod || calculated.contractYears,
    positiveYears(calculated.analysisPeriod, 1),
  );
  return {
    ...calculated,
    analysisPeriod: serviceYears,
    customerValueRows: Array.isArray(calculated.customerValueRows)
      ? calculated.customerValueRows.slice(0, serviceYears)
      : [],
    cashFlowRows: Array.isArray(calculated.cashFlowRows)
      ? calculated.cashFlowRows.slice(0, serviceYears)
      : [],
  };
}
