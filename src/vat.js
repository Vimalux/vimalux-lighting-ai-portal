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
