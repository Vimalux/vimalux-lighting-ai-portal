import { calculateBusinessCase as calculateBaseBusinessCase, numberValue } from "./calculationsBase.js";
import { calculateHybridSolar } from "./hybridSolar.js";
import { publishLiveBusinessCaseResult } from "./liveBusinessCaseResult.js";

export { numberValue };

const positive = (value) => Math.max(0, numberValue(value));

function hybridGridBeforeSolar(project, base) {
  const cloRate = base.cmsEnabled ? positive(project?.assumptions?.cloPercent) / 100 : 0;
  const powerAidRate = base.powerAidEnabled ? positive(project?.assumptions?.powerAidPercent) / 100 : 0;
  const hybridLedKwh = (base.groupRows || []).reduce((sum, row) => {
    if (!row?.upgradeSelected || !row?.product?.hybrid) return sum;
    return sum + positive(row.ledKwh);
  }, 0);
  const afterClo = hybridLedKwh * (1 - cloRate);
  return Math.max(0, afterClo * (1 - powerAidRate));
}

function addHybridToCashFlow(project, base, annualHybridBenefit) {
  if (!annualHybridBenefit || !Array.isArray(base.cashFlowRows)) return base;
  const energyEscalation = numberValue(project?.assumptions?.energyEscalation) / 100;
  const discountRate = numberValue(project?.assumptions?.discountRate) / 100;
  const upfront = positive(project?.assumptions?.upfrontPayment);
  const initial = base.dealType === "cash" ? -positive(base.totalCapex) : -upfront;
  let cumulative = initial;
  let npv = initial;
  let contractedGrossBenefitTotal = 0;
  let fullSmartGrossBenefitTotal = 0;
  let contractedSavingsTotal = initial;
  let fullSmartSavingsTotal = initial;

  const cashFlowRows = base.cashFlowRows.map((row, index) => {
    const solarBenefit = annualHybridBenefit * Math.pow(1 + energyEscalation, index);
    const netCashFlow = numberValue(row.netCashFlow) + solarBenefit;
    const grossBenefit = positive(row.grossBenefit) + solarBenefit;
    cumulative += netCashFlow;
    npv += netCashFlow / Math.pow(1 + discountRate, row.year);
    contractedSavingsTotal += netCashFlow;
    contractedGrossBenefitTotal += grossBenefit;
    return { ...row, hybridSolarSavingEUR: solarBenefit, grossBenefit, netCashFlow, cumulative };
  });

  const customerValueRows = (base.customerValueRows || []).map((row, index) => {
    const solarBenefit = annualHybridBenefit * Math.pow(1 + energyEscalation, index);
    const fullSmartBenefit = positive(row.fullSmartBenefit) + solarBenefit;
    const fullSmartNetBenefit = numberValue(row.fullSmartNetBenefit) + solarBenefit;
    fullSmartSavingsTotal += fullSmartNetBenefit;
    fullSmartGrossBenefitTotal += fullSmartBenefit;
    return {
      ...row,
      hybridSolarSavingEUR: solarBenefit,
      futureOperatingCost: Math.max(0, positive(row.futureOperatingCost) - solarBenefit),
      customerSaving: numberValue(row.customerSaving) + solarBenefit,
      fullSmartBenefit,
      fullSmartNetBenefit,
    };
  });

  return {
    ...base,
    cashFlowRows,
    customerValueRows,
    npv,
    lifecycleResult: cumulative,
    contractedSavingsTotal,
    fullSmartSavingsTotal,
    contractedGrossBenefitTotal,
    fullSmartGrossBenefitTotal,
    fullSmartAdditionalGrossSavings: fullSmartGrossBenefitTotal - contractedGrossBenefitTotal,
    fullSmartIncrementalSavings: fullSmartSavingsTotal - contractedSavingsTotal,
  };
}

export function calculateBusinessCase(project) {
  const base = calculateBaseBusinessCase(project);
  const hybrid = calculateHybridSolar(project);
  if (!hybrid.enabled || hybrid.totalUsableSolarKwh <= 0) {
    return publishLiveBusinessCaseResult(project, { ...base, hybridSolar: hybrid, hybridSolarSavingKwh: 0, hybridSolarSavingEUR: 0 });
  }

  const hybridEligibleGridKwh = hybridGridBeforeSolar(project, base);
  const hybridSolarSavingKwh = Math.min(positive(hybrid.totalUsableSolarKwh), hybridEligibleGridKwh, positive(base.finalKwh));
  const hybridSolarSavingEUR = hybridSolarSavingKwh * positive(project?.assumptions?.energyPrice);
  if (hybridSolarSavingKwh <= 0) {
    return publishLiveBusinessCaseResult(project, { ...base, hybridSolar: hybrid, hybridSolarSavingKwh: 0, hybridSolarSavingEUR: 0 });
  }

  const adjusted = addHybridToCashFlow(project, base, hybridSolarSavingEUR);
  const finalKwh = Math.max(0, positive(base.finalKwh) - hybridSolarSavingKwh);
  const upgradedFinalKwh = Math.max(0, positive(base.upgradedFinalKwh) - hybridSolarSavingKwh);
  const energySaving = positive(base.energySaving) + hybridSolarSavingEUR;
  const grossBenefit = positive(base.grossBenefit) + hybridSolarSavingEUR;
  const customerAnnualNetBenefit = numberValue(base.customerAnnualNetBenefit) + hybridSolarSavingEUR;
  const annualOperationalBenefit = grossBenefit - positive(base.totalAnnualOpex);
  const payback = annualOperationalBenefit > 0 ? positive(base.totalCapex) / annualOperationalBenefit : null;
  const roiPercent = positive(base.totalCapex) > 0 ? annualOperationalBenefit / positive(base.totalCapex) * 100 : 0;
  const energyReductionPercent = positive(base.baselineKwh) ? (positive(base.baselineKwh) - finalKwh) / positive(base.baselineKwh) * 100 : 0;
  const upgradedEnergyReductionPercent = positive(base.upgradedBaselineKwh) ? (positive(base.upgradedBaselineKwh) - upgradedFinalKwh) / positive(base.upgradedBaselineKwh) * 100 : 0;
  const co2ReductionKg = (positive(base.baselineKwh) - finalKwh) * positive(project?.assumptions?.co2KgPerKwh);
  const customerDecisionStatus = adjusted.npv > 0 && customerAnnualNetBenefit >= 0 ? "GO" : adjusted.npv > 0 || customerAnnualNetBenefit >= 0 ? "REVIEW" : "NO_GO";
  const decisionStatus = positive(base.netProjectMarginPercent) >= positive(base.minimumMarginPercent) && customerDecisionStatus === "GO"
    ? "GO"
    : positive(base.netProjectMarginPercent) >= 20 && customerDecisionStatus !== "NO_GO" ? "REVIEW" : "NO_GO";

  return publishLiveBusinessCaseResult(project, {
    ...adjusted,
    hybridSolar: hybrid,
    hybridSolarSavingKwh,
    hybridSolarSavingEUR,
    hybridEligibleGridKwh,
    finalKwh,
    upgradedFinalKwh,
    energySaving,
    energySavingWithoutPowerAid: numberValue(base.energySavingWithoutPowerAid) + hybridSolarSavingEUR,
    grossBenefit,
    customerAnnualNetBenefit,
    payback,
    roiPercent,
    energyReductionPercent,
    upgradedEnergyReductionPercent,
    co2ReductionKg,
    customerDecisionStatus,
    decisionStatus,
  });
}
