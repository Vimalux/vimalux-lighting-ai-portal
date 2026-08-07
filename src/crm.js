import { calculateBusinessCase, numberValue } from "./calculations.js";

const positive = (value) => Math.max(0, numberValue(value));

export function crmMetrics(project) {
  const result = calculateBusinessCase(project);
  const crm = project.crm || {};
  const won = crm.status === "won";
  const probability = won ? 100 : Math.min(100, positive(crm.closingProbability));
  const totalContractValue = crm.totalContractValue == null ? result.totalCapex : positive(crm.totalContractValue);
  const annualRecurringRevenue = result.annualRecurringRevenue;
  return {
    status: crm.status || "lead",
    probability,
    totalContractValue,
    weightedTcv: won ? totalContractValue : totalContractValue * probability / 100,
    annualRecurringRevenue,
    monthlyRecurringRevenue: annualRecurringRevenue / 12,
    cmsAnnualRevenue: result.cmsRevenue,
    savingsAsAServiceRevenue: result.savingsAsAServiceRevenue,
    contractYears: Math.max(1, Math.round(positive(project.assumptions.contractYears))),
  };
}

export function pipelineTotals(projects = []) {
  return projects.reduce((totals, project) => {
    const row = crmMetrics(project);
    totals.totalContractValue += row.totalContractValue;
    totals.weightedTcv += row.weightedTcv;
    totals.annualRecurringRevenue += row.annualRecurringRevenue;
    totals.monthlyRecurringRevenue += row.monthlyRecurringRevenue;
    return totals;
  }, { totalContractValue: 0, weightedTcv: 0, annualRecurringRevenue: 0, monthlyRecurringRevenue: 0 });
}
