export const numberValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  let text = String(value).trim().replace(/\s/g, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) text = comma > dot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  else if (comma >= 0) text = text.replace(/\./g, "").replace(",", ".");
  return Number.isFinite(Number(text)) ? Number(text) : 0;
};

const n = numberValue;
const positive = (v) => Math.max(0, n(v));

export function calculateBusinessCase(project) {
  const a = project.assumptions;
  const smartEnabled = Boolean(project.solution.smartEnabled);
  const powerAidEnabled = smartEnabled && Boolean(project.solution.powerAidEnabled);
  const cmsEnabled = smartEnabled && Boolean(project.solution.cmsEnabled);
  const ledById = Object.fromEntries(project.catalogue.led.map((p) => [p.id, p]));
  const smartById = Object.fromEntries(project.catalogue.smart.map((p) => [p.id, p]));
  const factor = { SAP: n(a.sapFactor), MH: n(a.mhFactor), MERCURY: n(a.mercuryFactor), LED: 1, OTHER: 1 };
  let totalQuantity = 0, smartQuantity = 0, baselineKwh = 0, ledKwh = 0, ledCapex = 0, ledCost = 0;
  const groupRows = project.groups.map((g) => {
    const quantity = positive(g.quantity);
    const product = ledById[g.proposedProductId] || {};
    const existingSystemWattage = positive(g.existingWattage) * (factor[g.technology] || 1);
    const groupBaseline = quantity * existingSystemWattage * positive(a.operatingHours) / 1000;
    const groupLed = quantity * positive(product.wattage) * positive(a.operatingHours) / 1000;
    const sale = g.projectLedPrice == null ? positive(product.salesPrice) : positive(g.projectLedPrice);
    totalQuantity += quantity;
    if (smartEnabled && g.smartAssigned) smartQuantity += quantity;
    baselineKwh += groupBaseline; ledKwh += groupLed; ledCapex += quantity * sale; ledCost += quantity * positive(product.costPrice);
    return { ...g, quantity, product, existingSystemWattage, baselineKwh: groupBaseline, ledKwh: groupLed, salesTotal: quantity * sale };
  });
  const lcuQuantity = smartEnabled ? smartQuantity : 0;
  const cloSavingKwh = smartEnabled ? ledKwh * positive(a.cloPercent) / 100 : 0;
  const afterCloKwh = Math.max(0, ledKwh - cloSavingKwh);
  const powerAidSavingKwh = powerAidEnabled ? afterCloKwh * positive(a.powerAidPercent) / 100 : 0;
  const finalKwh = Math.max(0, afterCloKwh - powerAidSavingKwh);
  const getSmart = (id) => smartById[id] || {};
  const price = (product, key = "salesPrice") => project.pricing.overrides[product.id]?.[key] ?? positive(product[key]);
  const lcu = getSmart(project.solution.lcuProductId), gateway = getSmart(project.solution.gatewayProductId);
  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);
  const gatewayQty = smartEnabled ? positive(project.solution.gatewayQuantity) : 0;
  const antennaQty = smartEnabled ? positive(project.solution.antennaQuantity) : 0;
  const meterQty = smartEnabled ? positive(project.solution.meterQuantity) : 0;
  const smartHardwareCapex = lcuQuantity * price(lcu);
  const implementationCapex = lcuQuantity * price(lcu, "implementationSalesPrice");
  const gatewayCapex = gatewayQty * price(gateway), antennaCapex = antennaQty * price(antenna), meterCapex = meterQty * price(meter);
  const freight = totalQuantity * positive(a.freightSalesPerLamp);
  const totalCapex = ledCapex + smartHardwareCapex + implementationCapex + gatewayCapex + antennaCapex + meterCapex + freight;
  const cmsOpex = cmsEnabled ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;
  const gatewayOpex = smartEnabled ? gatewayQty * price(gateway, "annualSalesPrice") : 0;
  const energySaving = (baselineKwh - finalKwh) * positive(a.energyPrice);
  const ledSavingKwh = Math.max(0, baselineKwh - ledKwh);
  const powerAidGrossSaving = powerAidSavingKwh * positive(a.energyPrice);
  const powerAidFee = powerAidEnabled ? powerAidGrossSaving * positive(a.powerAidSharePercent) / 100 : 0;
  const totalAnnualOpex = cmsOpex + gatewayOpex + powerAidFee;
  const maintenanceSaving = totalQuantity * Math.max(0, positive(a.existingMaintenance) - positive(a.newMaintenance));
  const grossBenefit = energySaving + maintenanceSaving;
  const financed = project.assumptions.financingModel === "laas";
  const principal = Math.max(0, totalCapex - positive(a.upfrontPayment));
  const months = Math.max(1, Math.round(positive(a.contractYears) * 12));
  const monthlyRate = positive(a.interestRate) / 1200;
  const monthlyPayment = financed ? (monthlyRate ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months) : 0;
  const annualPayment = monthlyPayment * 12;
  const customerAnnualNetBenefit = grossBenefit - totalAnnualOpex - annualPayment;
  const analysisPeriod = Math.max(1, Math.round(positive(a.analysisPeriod)));
  let cumulative = financed ? -positive(a.upfrontPayment) : -totalCapex, npv = cumulative;
  const cashFlowRows = [];
  for (let year = 1; year <= analysisPeriod; year += 1) {
    const energyGrowth = Math.pow(1 + n(a.energyEscalation) / 100, year - 1);
    const opexGrowth = Math.pow(1 + n(a.opexEscalation || a.energyEscalation) / 100, year - 1);
    const benefit = energySaving * energyGrowth + maintenanceSaving;
    const opex = totalAnnualOpex * opexGrowth;
    const payment = financed && year <= positive(a.contractYears) ? annualPayment : 0;
    const netCashFlow = benefit - opex - payment;
    cumulative += netCashFlow;
    npv += netCashFlow / Math.pow(1 + n(a.discountRate) / 100, year);
    cashFlowRows.push({ year, grossBenefit: benefit, opex, payment, netCashFlow, cumulative });
  }
  const annualOperationalBenefit = grossBenefit - totalAnnualOpex;
  const payback = annualOperationalBenefit > 0 ? totalCapex / annualOperationalBenefit : null;
  const lifecycleResult = cumulative;
  const energyReductionPercent = baselineKwh ? (baselineKwh - finalKwh) / baselineKwh * 100 : 0;
  const co2ReductionKg = (baselineKwh - finalKwh) * positive(a.co2KgPerKwh);
  const decisionStatus = npv > 0 && customerAnnualNetBenefit >= 0 ? "GO" : npv > 0 || customerAnnualNetBenefit >= 0 ? "REVIEW" : "NO_GO";
  return { totalQuantity, smartQuantity, lcuQuantity, baselineKwh, ledKwh, ledSavingKwh, cloSavingKwh, powerAidSavingKwh, finalKwh,
    ledCapex, ledCost, smartHardwareCapex, implementationCapex, gatewayCapex, antennaCapex, meterCapex, freight, totalCapex,
    cmsOpex, gatewayOpex, powerAidFee, totalAnnualOpex, energySaving, maintenanceSaving, grossBenefit, monthlyPayment, annualPayment,
    customerAnnualNetBenefit, payback, npv, lifecycleResult, analysisPeriod, energyReductionPercent, co2ReductionKg, decisionStatus,
    cashFlowRows, groupRows, hardware: { lcu, gateway, antenna, meter, gatewayQty, antennaQty, meterQty }, powerAidEnabled, cmsEnabled, smartEnabled };
}
