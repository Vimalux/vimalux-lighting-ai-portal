const n = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const positive = (value) => Math.max(0, n(value));
const pct = (value) => Math.min(100, Math.max(0, positive(value))) / 100;

export function vatSettings(project = {}) {
  const a = project.assumptions || {};
  const mode = ["non_deductible", "deductible", "partial"].includes(a.vatRecoverability)
    ? a.vatRecoverability
    : "non_deductible";
  const recoverablePercent = mode === "deductible" ? 100 : mode === "partial" ? Math.min(100, Math.max(0, positive(a.vatRecoverablePercent))) : 0;
  return {
    mode,
    recoverablePercent,
    hardwareRate: positive(a.vatHardwarePercent ?? 22),
    digitalRate: positive(a.vatDigitalPercent ?? 22),
    maintenanceRate: positive(a.vatMaintenancePercent ?? 22),
    structuralRate: positive(a.vatStructuralPercent ?? 10),
  };
}

export function calculateVatSummary(project = {}, result = {}) {
  const settings = vatSettings(project);
  const rows = Array.isArray(result.additionalCosts?.rows) ? result.additionalCosts.rows : [];
  const structuralCapex = rows
    .filter((row) => row.costType === "capex" && row.category === "opere_civili")
    .reduce((sum, row) => sum + positive(row.salesTotal), 0);
  const maintenanceAnnual = rows
    .filter((row) => row.costType === "opex_annual" && row.category === "lavoro")
    .reduce((sum, row) => sum + positive(row.salesTotal), 0);
  const otherAnnualAdditional = rows
    .filter((row) => row.costType === "opex_annual" && row.category !== "lavoro")
    .reduce((sum, row) => sum + positive(row.salesTotal), 0);

  const capexNet = positive(result.totalCapex ?? result.capex);
  const annualOpexNet = positive(result.totalAnnualOpex ?? result.annualOpex);
  const hardwareCapex = Math.max(0, capexNet - structuralCapex);
  const baseDigitalAnnual = Math.max(0, annualOpexNet - maintenanceAnnual - otherAnnualAdditional);
  const digitalAnnual = baseDigitalAnnual + otherAnnualAdditional;

  const capexVat = hardwareCapex * pct(settings.hardwareRate) + structuralCapex * pct(settings.structuralRate);
  const annualOpexVat = digitalAnnual * pct(settings.digitalRate) + maintenanceAnnual * pct(settings.maintenanceRate);
  const unrecoverableShare = 1 - settings.recoverablePercent / 100;
  const unrecoverableCapexVat = capexVat * unrecoverableShare;
  const unrecoverableAnnualOpexVat = annualOpexVat * unrecoverableShare;
  const municipalityCapexCash = capexNet + unrecoverableCapexVat;
  const municipalityAnnualOpexCash = annualOpexNet + unrecoverableAnnualOpexVat;

  const grossBenefit = positive(result.grossBenefit);
  const municipalityAnnualNetBenefit = grossBenefit - municipalityAnnualOpexCash;
  const municipalityPayback = municipalityAnnualNetBenefit > 0 ? municipalityCapexCash / municipalityAnnualNetBenefit : null;

  const discountRate = positive(project.assumptions?.discountRate) / 100;
  const cashRows = Array.isArray(result.cashFlowRows) ? result.cashFlowRows : [];
  let municipalityNpv = -(result.dealType === "cash" ? municipalityCapexCash : positive(project.assumptions?.upfrontPayment));
  cashRows.forEach((row) => {
    const year = Math.max(1, positive(row.year));
    const serviceVat = positive(row.serviceOpex) * pct(settings.digitalRate) * unrecoverableShare;
    const paymentVat = result.dealType === "cash" ? 0 : positive(row.payment) * pct(settings.hardwareRate) * unrecoverableShare;
    const municipalityNet = positive(row.grossBenefit) - positive(row.serviceOpex) - positive(row.payment) - serviceVat - paymentVat;
    municipalityNpv += municipalityNet / Math.pow(1 + discountRate, year);
  });

  return {
    ...settings,
    capexNet,
    annualOpexNet,
    hardwareCapex,
    structuralCapex,
    digitalAnnual,
    maintenanceAnnual,
    capexVat,
    annualOpexVat,
    unrecoverableCapexVat,
    unrecoverableAnnualOpexVat,
    municipalityCapexCash,
    municipalityAnnualOpexCash,
    municipalityAnnualNetBenefit,
    municipalityPayback,
    municipalityNpv,
  };
}

export function applyCustomerVatCashFlow(project = {}, result = {}) {
  const settings = vatSettings(project);
  const unrecoverableShare = 1 - settings.recoverablePercent / 100;
  const energyRate = pct(project.assumptions?.vatEnergyPercent ?? settings.hardwareRate);
  const maintenanceRate = pct(settings.maintenanceRate);
  const digitalRate = pct(settings.digitalRate);
  const hardwareRate = pct(settings.hardwareRate);
  const discountRate = positive(project.assumptions?.discountRate) / 100;
  const summary = calculateVatSummary(project, result);
  const netRows = Array.isArray(result.cashFlowRows) ? result.cashFlowRows : [];
  const initialNet = result.dealType === "cash" ? positive(result.totalCapex) : positive(project.assumptions?.upfrontPayment);
  const initialVat = result.dealType === "cash" ? summary.unrecoverableCapexVat : initialNet * hardwareRate * unrecoverableShare;
  let cumulative = -(initialNet + initialVat);
  let npv = cumulative;

  const customerCashFlowRows = netRows.map((row) => {
    const netMaintenance = positive(row.maintenanceSavingEUR);
    const netEnergy = Math.max(0, positive(row.grossBenefit) - netMaintenance);
    const benefitVat = (netEnergy * energyRate + netMaintenance * maintenanceRate) * unrecoverableShare;
    const customerGrossEnergyBenefit = netEnergy * (1 + energyRate * unrecoverableShare);
    const customerGrossMaintenanceBenefit = netMaintenance * (1 + maintenanceRate * unrecoverableShare);
    const customerGrossBenefit = customerGrossEnergyBenefit + customerGrossMaintenanceBenefit;
    const netService = result.dealType === "noleggio_operativo" ? positive(row.opex) : positive(row.serviceOpex);
    const netPayment = positive(row.payment);
    const serviceWithinPayment = result.dealType === "noleggio_operativo" ? Math.min(netPayment, netService) : 0;
    const hardwarePayment = result.dealType === "noleggio_operativo" ? Math.max(0, netPayment - serviceWithinPayment) : netPayment;
    const billableService = result.dealType === "noleggio_operativo" ? serviceWithinPayment : netService;
    const paymentVat = (hardwarePayment * hardwareRate + billableService * digitalRate) * unrecoverableShare;
    const customerGrossPayment = netPayment + (result.dealType === "noleggio_operativo" ? paymentVat : hardwarePayment * hardwareRate * unrecoverableShare);
    const customerGrossServiceOpex = result.dealType === "noleggio_operativo" ? 0 : netService * (1 + digitalRate * unrecoverableShare);
    const customerNetCashFlow = customerGrossBenefit - customerGrossPayment - customerGrossServiceOpex;
    cumulative += customerNetCashFlow;
    npv += customerNetCashFlow / Math.pow(1 + discountRate, positive(row.year));
    return { ...row, netGrossBenefit: positive(row.grossBenefit), netContractedCustomerPayment: positive(row.contractedCustomerPayment), benefitVat, paymentVat, customerGrossEnergyBenefit, customerGrossMaintenanceBenefit, customerGrossBenefit, customerGrossPayment, customerGrossServiceOpex, customerNetCashFlow, customerCumulative: cumulative };
  });

  const first = customerCashFlowRows[0];
  const customerCashAnnualNetBenefit = first?.customerNetCashFlow ?? Number(result.customerAnnualNetBenefit || 0);
  const customerCashDecisionStatus = npv > 0 && customerCashAnnualNetBenefit >= 0 ? "GO" : npv > 0 || customerCashAnnualNetBenefit >= 0 ? "REVIEW" : "NO_GO";
  return {
    ...result,
    vatSummary: summary,
    customerCashFlowRows,
    customerGrossAnnualBenefit: first?.customerGrossBenefit ?? positive(result.grossBenefit),
    customerGrossAnnualPayment: first ? first.customerGrossPayment + first.customerGrossServiceOpex : positive(result.customerAnnualPayment),
    customerGrossMonthlyPayment: first ? (first.customerGrossPayment + first.customerGrossServiceOpex) / 12 : positive(result.customerMonthlyPayment),
    customerCashAnnualNetBenefit,
    customerCashDecisionStatus,
    customerCashNpv: npv,
    customerCashLifecycleResult: cumulative,
  };
}

export function customerAnalysisResult(result = {}) {
  const first = result.customerCashFlowRows?.[0];
  if (!first) return result;
  const allInclusive = result.dealType === "noleggio_operativo";
  const serviceScale = positive(result.totalAnnualOpex) > 0 ? first.customerGrossServiceOpex / positive(result.totalAnnualOpex) : 1;
  return {
    ...result,
    customerMonthlyPaymentNet: positive(result.monthlyPayment),
    customerAnnualPaymentNet: positive(result.customerAnnualPayment),
    monthlyPayment: result.customerGrossMonthlyPayment,
    customerMonthlyPayment: result.customerGrossMonthlyPayment,
    customerAnnualPayment: result.customerGrossAnnualPayment,
    allInclusiveAnnualPayment: allInclusive ? result.customerGrossAnnualPayment : result.allInclusiveAnnualPayment,
    financingAnnualPayment: result.dealType === "finance" ? first.customerGrossPayment : result.financingAnnualPayment,
    fixedAnnualOpex: allInclusive ? 0 : positive(result.fixedAnnualOpex) * serviceScale,
    powerAidCustomerFee: allInclusive ? 0 : positive(result.powerAidCustomerFee) * serviceScale,
    energySaving: first.customerGrossEnergyBenefit,
    maintenanceSaving: first.customerGrossMaintenanceBenefit,
    grossBenefit: first.customerGrossBenefit,
    customerAnnualNetBenefit: result.customerCashAnnualNetBenefit,
    npv: result.customerCashNpv,
    lifecycleResult: result.customerCashLifecycleResult,
    customerDecisionStatus: result.customerCashDecisionStatus,
    cashFlowRows: result.customerCashFlowRows.map((row) => ({ ...row, grossBenefit: row.customerGrossBenefit, serviceOpex: row.customerGrossServiceOpex, opex: row.customerGrossServiceOpex, payment: row.customerGrossPayment, netCashFlow: row.customerNetCashFlow, cumulative: row.customerCumulative })),
  };
}
