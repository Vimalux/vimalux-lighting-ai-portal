import { numberValue } from "./calculations.js";

const positive = (value) => Math.max(0, numberValue(value));

export function normalizeProbability(value) {
  return Math.min(100, positive(value));
}

export function probabilityFactor(value) {
  return normalizeProbability(value) / 100;
}

export function calculateWeightedTcv(totalContractValue, probability) {
  return positive(totalContractValue) * probabilityFactor(probability);
}

export function calculateWeightedArr(annualRecurringRevenue, probability) {
  return positive(annualRecurringRevenue) * probabilityFactor(probability);
}

export function formatProbabilityPoints(value, language = "en") {
  const locale = language === "it" ? "it-IT" : language === "da" ? "da-DK" : "en-IE";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(normalizeProbability(value))}%`;
}

export function crmMetrics(project) {
  const crm = project.crm || {};
  const result = crm.businessCase || project.commercialSnapshot || {};
  const won = crm.status === "won";
  const probability = won ? 100 : normalizeProbability(crm.closingProbability);
  const totalContractValue = crm.totalContractValue == null ? positive(result.tcv ?? result.totalContractRevenue) : positive(crm.totalContractValue);
  const annualRecurringRevenue = positive(result.arr ?? result.annualRecurringRevenue);
  return {
    status: crm.status || "lead",
    probability,
    totalContractValue,
    probabilityFactor: probabilityFactor(probability),
    weightedTcv: calculateWeightedTcv(totalContractValue, probability),
    weightedArr: calculateWeightedArr(annualRecurringRevenue, probability),
    dealType: result.dealType || project.assumptions?.dealType,
    offerCapex: positive(result.capex ?? result.offerCapex),
    customerAnnualPayment: positive(result.annualCustomerPayment ?? result.customerAnnualPayment),
    annualRecurringRevenue,
    monthlyRecurringRevenue: annualRecurringRevenue / 12,
    cmsAnnualRevenue: result.cmsRevenue,
    savingsAsAServiceRevenue: result.savingsAsAServiceRevenue,
    contractYears: Math.max(1, Math.round(positive(project.assumptions.serviceAgreementPeriod ?? project.assumptions.contractYears))),
  };
}

export function pipelineTotals(projects = []) {
  return projects.reduce((totals, project) => {
    const row = crmMetrics(project);
    totals.totalContractValue += row.totalContractValue;
    totals.weightedTcv += row.weightedTcv;
    totals.annualRecurringRevenue += row.annualRecurringRevenue;
    totals.monthlyRecurringRevenue += row.monthlyRecurringRevenue;
    totals.weightedArr += row.weightedArr;
    return totals;
  }, { totalContractValue: 0, weightedTcv: 0, annualRecurringRevenue: 0, monthlyRecurringRevenue: 0, weightedArr: 0 });
}

export function pipelineStageTotals(projects = [], stages = ["lead", "qualified", "proposal", "negotiation", "closing", "won"]) {
  return stages.map((stage) => {
    const rows = projects.map(crmMetrics).filter((row) => row.status === stage);
    const count = rows.length;
    return {
      stage,
      count,
      totalContractValue: rows.reduce((sum, row) => sum + row.totalContractValue, 0),
      weightedTcv: rows.reduce((sum, row) => sum + row.weightedTcv, 0),
      averageProbability: count ? rows.reduce((sum, row) => sum + row.probability, 0) / count : 0,
    };
  });
}

export function probabilityWeightedForecast(projects = []) {
  return projects.reduce((total, project) => total + crmMetrics(project).weightedTcv, 0);
}
