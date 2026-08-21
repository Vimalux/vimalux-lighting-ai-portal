import { calculateBusinessCase, numberValue } from "./calculations.js";

const positive = (value) => Math.max(0, numberValue(value));

export function buildBusinessCaseSnapshot(project, calculatedAt = new Date().toISOString()) {
  const result = calculateBusinessCase(project);
  const existingLuminaires = positive(result.totalQuantity);
  const upgradeLuminaires = positive(result.upgradedQuantity);
  const smartConnectedLuminaires = positive(result.lcuQuantity);
  const energyPrice = positive(project.assumptions?.energyPrice);
  return {
    source: "VIMALUX Intelligence calculation engine",
    sourceStatus: "calculated",
    version: Number(project.version) || 1,
    calculatedAt,
    businessCaseId: project.project?.businessCaseId || "",

    // Shared VIMALUX KPI dictionary. Intelligence is authoritative for these fields.
    existingLuminaires,
    upgradeLuminaires,
    smartConnectedLuminaires,
    upgradeCoveragePct: existingLuminaires ? upgradeLuminaires / existingLuminaires * 100 : 0,
    contractYears: positive(result.serviceAgreementPeriod),

    capex: result.totalCapex,
    annualContractRevenue: result.customerAnnualPayment,
    annualOpex: result.totalAnnualOpex,
    annualCustomerPayment: result.customerAnnualPayment,
    monthlyCustomerPayment: result.customerMonthlyPayment,
    tcv: result.totalContractRevenue,
    arr: result.annualRecurringRevenue,
    mrr: result.monthlyRecurringRevenue ?? result.annualRecurringRevenue / 12,
    annualCustomerNetBenefit: result.customerAnnualNetBenefit,
    paybackYears: result.payback,
    npv: result.npv,
    lifecycleResult: result.lifecycleResult,

    annualEnergyCostBefore: positive(result.baselineKwh) * energyPrice,
    annualEnergyCostAfter: positive(result.finalKwh) * energyPrice,
    annualEnergySavingEUR: positive(result.energySaving),
    energySavingKwh: Math.max(0, result.baselineKwh - result.finalKwh),
    energyReductionPct: result.energyReductionPercent,
    co2ReductionTons: result.co2ReductionKg / 1000,

    // Legacy alias retained for existing consumers.
    smartNodeCount: smartConnectedLuminaires,
    datekArr: result.cmsRevenue,
    datekContractValue: result.cmsRevenue && result.serviceAgreementPeriod
      ? Array.from({ length: result.serviceAgreementPeriod }, (_, index) => result.cmsRevenue * Math.pow(1 + positive(project.assumptions?.opexEscalation) / 100, index)).reduce((sum, value) => sum + value, 0)
      : 0,
    powerAidCustomerFee: result.powerAidCustomerFee,
    powerAidSupplierCost: result.powerAidSupplierCost,
    powerAidVimaluxMargin: result.powerAidVimaluxMargin,
    goStatus: result.customerDecisionStatus,
  };
}

export function syncBusinessCaseResult(project, calculatedAt) {
  const businessCase = buildBusinessCaseSnapshot(project, calculatedAt);
  return {
    ...project,
    crm: { ...(project.crm || {}), goStatus: businessCase.goStatus, businessCase },
  };
}

export function applyAuthoritativeBusinessCase(project, values = {}) {
  const current = project.crm?.businessCase || {};
  const businessCase = {
    ...current,
    ...values,
    source: values.source || "VIMALUX Intelligence sync",
    sourceStatus: values.sourceStatus || "synced",
    version: Number(values.version ?? current.version ?? project.version) || 1,
    calculatedAt: values.calculatedAt || new Date().toISOString(),
    businessCaseId: values.businessCaseId || project.project?.businessCaseId || "",
  };
  return { ...project, crm: { ...(project.crm || {}), goStatus: businessCase.goStatus || project.crm?.goStatus || "", businessCase } };
}
