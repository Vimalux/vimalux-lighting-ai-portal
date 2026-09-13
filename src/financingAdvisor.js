import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";

const n = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const positive = (value) => Math.max(0, n(value));
const years = (value, fallback = 1) => Math.max(1, Math.round(positive(value) || fallback));

function modeledProject(project, financingYears) {
  return {
    ...project,
    assumptions: {
      ...(project.assumptions || {}),
      financingPeriod: financingYears,
      financingYears,
      // The advisor must compare financing durations on the same underlying economics.
      // A manually negotiated/imported all-inclusive canone is preserved in stored data,
      // but is intentionally ignored in this advisory calculation.
      allInclusiveAnnualPayment: 0,
    },
  };
}

function evaluateDuration(project, financingYears, serviceYears) {
  const result = calculateBusinessCase(applyWarrantyPricing(modeledProject(project, financingYears)));
  const rows = (result.cashFlowRows || []).slice(0, serviceYears);
  const evaluated = rows.map((row) => {
    const financingPayment = row.year <= financingYears ? positive(result.financingAnnualPayment) : 0;
    const recurringOpex = positive(row.opex);
    const grossBenefit = positive(row.grossBenefit);
    const netCashFlow = grossBenefit - financingPayment - recurringOpex;
    const marginPercent = grossBenefit > 0 ? netCashFlow / grossBenefit * 100 : (netCashFlow >= 0 ? 100 : -100);
    return {
      year: row.year,
      grossBenefit,
      financingPayment,
      recurringOpex,
      netCashFlow,
      marginPercent,
    };
  });
  const minAnnualCashFlow = evaluated.length ? Math.min(...evaluated.map((row) => row.netCashFlow)) : 0;
  const minMarginPercent = evaluated.length ? Math.min(...evaluated.map((row) => row.marginPercent)) : 0;
  const year1 = evaluated[0] || { grossBenefit: 0, financingPayment: 0, recurringOpex: 0, netCashFlow: 0, marginPercent: 0 };
  return {
    financingYears,
    minAnnualCashFlow,
    minMarginPercent,
    year1,
    rows: evaluated,
    qualifies: evaluated.length > 0 && evaluated.every((row) => row.netCashFlow >= -0.01),
  };
}

export function financingCashflowAdvisor(project, options = {}) {
  const dealType = project?.assumptions?.dealType || "cash";
  if (dealType === "cash") return null;

  const serviceYears = years(
    project?.assumptions?.serviceAgreementPeriod || project?.assumptions?.contractYears,
    10,
  );
  const minimumYears = Math.min(serviceYears, years(options.minimumYears, 1));
  const maximumYears = Math.max(minimumYears, Math.min(serviceYears, years(options.maximumYears, serviceYears)));
  const safetyMarginPercent = Math.max(0, n(options.safetyMarginPercent ?? 10));

  const scenarios = [];
  for (let financingYears = minimumYears; financingYears <= maximumYears; financingYears += 1) {
    scenarios.push(evaluateDuration(project, financingYears, serviceYears));
  }

  const minimum = scenarios.find((scenario) => scenario.qualifies) || null;
  const recommended = scenarios.find((scenario) =>
    scenario.qualifies && scenario.rows.every((row) => row.marginPercent >= safetyMarginPercent - 0.0001),
  ) || minimum;

  return {
    serviceYears,
    safetyMarginPercent,
    minimum,
    recommended,
    scenarios,
    hasCashflowNeutralDuration: Boolean(minimum),
  };
}
