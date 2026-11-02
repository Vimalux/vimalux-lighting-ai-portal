import { calculateBusinessCase } from "./calculations.js";

// All operations are in-memory. This module never calls persistence, emits browser events,
// changes URL state, or invokes advisor Apply/Restore.
const integer = (value) => Number.isInteger(value) ? value : Number.NaN;
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function clone(value) {
  if (!value || typeof value !== "object") throw new TypeError("Business Case snapshot required");
  return structuredClone(value);
}

export function createScenarioProject(snapshot, { financingYears, cmsYears, adaptiveYears, horizonYears = 15 }) {
  const terms = [financingYears, cmsYears, adaptiveYears, horizonYears].map(integer);
  if (terms.some((x) => !Number.isFinite(x) || x < 1 || x > 15)) {
    throw new RangeError("Scenario periods must be integer years between 1 and 15");
  }
  if (financingYears < 5) throw new RangeError("Financing term must be at least 5 years");
  if (adaptiveYears > cmsYears) throw new RangeError("Adaptive term requires CMS service coverage");
  if (horizonYears < Math.max(financingYears, cmsYears, adaptiveYears)) {
    throw new RangeError("Analysis horizon cannot end before contracts");
  }
  const project = clone(snapshot);
  if (project?.assumptions?.dealType !== "finance" && project?.assumptions?.financingModel !== "finance") {
    throw new Error("Initial optimizer supports finance agreements only");
  }
  project.assumptions = {
    ...project.assumptions,
    financingPeriod: financingYears,
    financingYears,
    serviceAgreementPeriod: cmsYears,
    contractYears: cmsYears,
    powerAidServicePeriod: adaptiveYears,
    analysisPeriod: horizonYears,
  };
  return project;
}

export function simulateScenario(snapshot, terms, { minimumMarginPercent = 10 } = {}) {
  const scenarioProject = createScenarioProject(snapshot, terms);
  const result = calculateBusinessCase(scenarioProject, { publish: false });
  const horizon = terms.horizonYears ?? 15;
  const rows = (result.cashFlowRows || []).map((row) => ({
    year: row.year,
    grossBenefit: numeric(row.grossBenefit),
    serviceOpex: numeric(row.serviceOpex),
    financePayment: numeric(row.financePayment),
    netCashFlow: numeric(row.netCashFlow),
    cmsActive: Boolean(row.cmsActive),
    adaptiveActive: Boolean(row.powerAidActive),
  }));
  const validRows = rows.length === horizon && rows.every((row) =>
    Number.isFinite(row.netCashFlow) && row.year >= 1 && row.year <= horizon);
  const minimumCashflow = rows.length ? Math.min(...rows.map((r) => r.netCashFlow)) : Number.NEGATIVE_INFINITY;
  const marginPass = rows.every((r) => r.grossBenefit > 0 &&
    r.netCashFlow / r.grossBenefit * 100 >= minimumMarginPercent);
  const discountRate = numeric(snapshot?.assumptions?.discountRate) / 100;
  const upFront = numeric(snapshot?.assumptions?.upfrontPayment);
  const comparableNpv = -upFront + rows.reduce((sum, row) =>
    sum + row.netCashFlow / Math.pow(1 + discountRate, row.year), 0);
  const reasonCodes = [];
  if (!validRows) reasonCodes.push("INCOMPLETE_CASHFLOW");
  if (!marginPass) reasonCodes.push("INSUFFICIENT_CASHFLOW_MARGIN");
  const warrantyYears = numeric(snapshot?.assumptions?.warrantyYears);
  if (warrantyYears > 0 && terms.cmsYears > warrantyYears) reasonCodes.push("WARRANTY_GAP_REQUIRES_REVIEW");
  return {
    terms: { ...terms, horizonYears: horizon },
    valid: validRows && marginPass,
    reasonCodes,
    firstYearBenefit: rows[0]?.netCashFlow ?? null,
    minAnnualCashflow: minimumCashflow,
    comparableNpv: validRows ? comparableNpv : null,
    totalFinancePayment: rows.reduce((sum, r) => sum + r.financePayment, 0),
    totalServicePayment: rows.reduce((sum, r) => sum + r.serviceOpex, 0),
    totalCapex: result.totalCapex,
    cashflowRows: rows,
    riskAssessment: "PENDING_STRESS_TESTS",
  };
}

export function optimizeScenarios(snapshot, { minFinancingYears = 5, maxYears = 15, cmsMinYears = 10, minimumMarginPercent = 10 } = {}) {
  if (!Number.isInteger(maxYears) || maxYears < 5 || maxYears > 15) throw new RangeError("maxYears 5..15");
  if (!Number.isInteger(minFinancingYears) || minFinancingYears < 5 || minFinancingYears > maxYears) throw new RangeError("minFinancingYears");
  if (!Number.isInteger(cmsMinYears) || cmsMinYears < 1 || cmsMinYears > maxYears) throw new RangeError("cmsMinYears");
  const scenarios = [];
  for (let financingYears = minFinancingYears; financingYears <= maxYears; financingYears++) {
    for (let cmsYears = cmsMinYears; cmsYears <= maxYears; cmsYears++) {
      for (let adaptiveYears = 1; adaptiveYears <= cmsYears; adaptiveYears++) {
        scenarios.push(simulateScenario(snapshot, { financingYears, cmsYears, adaptiveYears, horizonYears: 15 }, { minimumMarginPercent }));
      }
    }
  }
  // NPV ranking is provisional until service-expiry and warranty stress assumptions are validated.
  const eligible = scenarios.filter((s) => s.valid).sort((a, b) => b.comparableNpv - a.comparableNpv);
  return { scenarios, eligible, preliminaryBest: eligible[0] ?? null, recommendationStatus: "PROVISIONAL_NOT_RISK_ADJUSTED" };
}
