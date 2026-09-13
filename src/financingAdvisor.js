import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";

const n = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const positive = (value) => Math.max(0, n(value));
const years = (value, fallback = 1) => Math.max(1, Math.round(positive(value) || fallback));

function dealTypeOf(project) {
  const explicit = project?.assumptions?.dealType;
  if (["cash", "finance", "noleggio_operativo"].includes(explicit)) return explicit;
  const legacy = project?.assumptions?.financingModel;
  if (legacy === "finance") return "finance";
  if (["laas", "ppp"].includes(legacy)) return "noleggio_operativo";
  return "cash";
}

function modeledProject(project, durationYears, mode) {
  const assumptions = {
    ...(project.assumptions || {}),
    financingPeriod: durationYears,
    financingYears: durationYears,
    // Advisory scenarios must be comparable on calculated economics.
    // Stored/manual canone is never overwritten in the project itself.
    allInclusiveAnnualPayment: 0,
  };

  if (mode === "noleggio_operativo") {
    assumptions.serviceAgreementPeriod = durationYears;
    assumptions.contractYears = durationYears;
    assumptions.analysisPeriod = durationYears;
    if (project?.solution?.powerAidEnabled) assumptions.powerAidServicePeriod = durationYears;
  }

  return { ...project, assumptions };
}

function evaluateFinanceDuration(project, financingYears, serviceYears) {
  const result = calculateBusinessCase(applyWarrantyPricing(modeledProject(project, financingYears, "finance")));
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
      includedOpex: 0,
      allInclusivePayment: 0,
      customerPayment: financingPayment + recurringOpex,
      netCashFlow,
      marginPercent,
    };
  });
  return summarizeScenario(financingYears, evaluated, "finance");
}

function evaluateNoleggioDuration(project, durationYears) {
  const result = calculateBusinessCase(applyWarrantyPricing(modeledProject(project, durationYears, "noleggio_operativo")));
  const rows = (result.cashFlowRows || []).slice(0, durationYears);
  const evaluated = rows.map((row) => {
    const grossBenefit = positive(row.grossBenefit);
    const allInclusivePayment = positive(row.payment || result.allInclusiveAnnualPayment);
    const includedOpex = positive(row.opex);
    const netCashFlow = grossBenefit - allInclusivePayment;
    const marginPercent = grossBenefit > 0 ? netCashFlow / grossBenefit * 100 : (netCashFlow >= 0 ? 100 : -100);
    return {
      year: row.year,
      grossBenefit,
      financingPayment: 0,
      recurringOpex: 0,
      includedOpex,
      allInclusivePayment,
      customerPayment: allInclusivePayment,
      netCashFlow,
      marginPercent,
    };
  });
  return summarizeScenario(durationYears, evaluated, "noleggio_operativo");
}

function summarizeScenario(durationYears, evaluated, mode) {
  const minAnnualCashFlow = evaluated.length ? Math.min(...evaluated.map((row) => row.netCashFlow)) : 0;
  const minMarginPercent = evaluated.length ? Math.min(...evaluated.map((row) => row.marginPercent)) : 0;
  const year1 = evaluated[0] || {
    grossBenefit: 0,
    financingPayment: 0,
    recurringOpex: 0,
    includedOpex: 0,
    allInclusivePayment: 0,
    customerPayment: 0,
    netCashFlow: 0,
    marginPercent: 0,
  };
  return {
    financingYears: durationYears,
    durationYears,
    contractYears: mode === "noleggio_operativo" ? durationYears : null,
    mode,
    minAnnualCashFlow,
    minMarginPercent,
    year1,
    rows: evaluated,
    qualifies: evaluated.length > 0 && evaluated.every((row) => row.netCashFlow >= -0.01),
  };
}

export function financingCashflowAdvisor(project, options = {}) {
  const mode = dealTypeOf(project);
  if (mode === "cash") return null;

  const currentServiceYears = years(
    project?.assumptions?.serviceAgreementPeriod || project?.assumptions?.contractYears,
    10,
  );
  const safetyMarginPercent = Math.max(0, n(options.safetyMarginPercent ?? 10));

  let minimumYears;
  let maximumYears;
  if (mode === "noleggio_operativo") {
    minimumYears = years(options.minimumYears, 1);
    maximumYears = Math.max(minimumYears, years(options.maximumYears, 20));
  } else {
    minimumYears = Math.min(currentServiceYears, years(options.minimumYears, 1));
    maximumYears = Math.max(minimumYears, Math.min(currentServiceYears, years(options.maximumYears, currentServiceYears)));
  }

  const scenarios = [];
  for (let durationYears = minimumYears; durationYears <= maximumYears; durationYears += 1) {
    scenarios.push(mode === "noleggio_operativo"
      ? evaluateNoleggioDuration(project, durationYears)
      : evaluateFinanceDuration(project, durationYears, currentServiceYears));
  }

  const minimum = scenarios.find((scenario) => scenario.qualifies) || null;
  const recommended = scenarios.find((scenario) =>
    scenario.qualifies && scenario.rows.every((row) => row.marginPercent >= safetyMarginPercent - 0.0001),
  ) || minimum;

  return {
    mode,
    serviceYears: currentServiceYears,
    currentContractYears: currentServiceYears,
    minimumYears,
    maximumYears,
    safetyMarginPercent,
    minimum,
    recommended,
    scenarios,
    hasCashflowNeutralDuration: Boolean(minimum),
  };
}
