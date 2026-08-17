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
  const cmsEnabled = smartEnabled && Boolean(project.solution.cmsEnabled);
  const powerAidEnabled = cmsEnabled && Boolean(project.solution.powerAidEnabled);
  const ledById = Object.fromEntries(project.catalogue.led.map((p) => [p.id, p]));
  const smartById = Object.fromEntries(project.catalogue.smart.map((p) => [p.id, p]));
  const factor = { SAP: n(a.sapFactor), MH: n(a.mhFactor), MERCURY: n(a.mercuryFactor), LED: 1, OTHER: 1 };
  let totalQuantity = 0, upgradedQuantity = 0, smartQuantity = 0, nominalSystemKwh = 0, existingDimmingSavingKwh = 0, baselineKwh = 0, upgradedBaselineKwh = 0, upgradedLedKwh = 0, ledKwh = 0, smartLedKwh = 0, powerAidLedKwh = 0, ledCapex = 0, ledCost = 0;
  const groupRows = project.groups.map((g) => {
    const quantity = positive(g.quantity);
    const product = ledById[g.proposedProductId] || {};
    const systemFactor = positive(g.existingSystemFactor) || factor[g.technology] || 1;
    const existingSystemWattage = positive(g.existingWattage) * systemFactor;
    const profileDimmingPercent = positive(a.operatingHours)
      ? positive(g.existingReducedHours) * (1 - Math.min(100, positive(g.existingReducedLoadPercent)) / 100) / positive(a.operatingHours) * 100
      : 0;
    const dimmingPercent = g.existingDimmingProfile === "fixed"
      ? Math.min(100, g.existingDimmingMethod === "profile" ? profileDimmingPercent : positive(g.existingDimmingPercent))
      : 0;
    const effectiveBaselineWattage = existingSystemWattage * (1 - dimmingPercent / 100);
    const groupNominalSystemKwh = quantity * existingSystemWattage * positive(a.operatingHours) / 1000;
    const groupExistingDimmingSavingKwh = groupNominalSystemKwh * dimmingPercent / 100;
    const groupBaseline = groupNominalSystemKwh - groupExistingDimmingSavingKwh;
    const upgradeSelected = g.upgradeSelected !== false;
    const configuredLedWattage = positive(g.projectLedWattage) || positive(product.wattage);
    const proposedLedKwh = quantity * configuredLedWattage * positive(a.operatingHours) / 1000;
    const groupLed = upgradeSelected ? proposedLedKwh : groupBaseline;
    const sale = g.projectLedPrice == null ? positive(product.salesPrice) : positive(g.projectLedPrice);
    totalQuantity += quantity;
    if (upgradeSelected) {
      upgradedQuantity += quantity;
      upgradedBaselineKwh += groupBaseline;
      upgradedLedKwh += proposedLedKwh;
    }
    if (upgradeSelected && smartEnabled) {
      smartQuantity += quantity;
      smartLedKwh += groupLed;
      if (powerAidEnabled) powerAidLedKwh += groupLed;
    }
    nominalSystemKwh += groupNominalSystemKwh; existingDimmingSavingKwh += groupExistingDimmingSavingKwh; baselineKwh += groupBaseline; ledKwh += groupLed; ledCapex += upgradeSelected ? quantity * sale : 0; ledCost += upgradeSelected ? quantity * positive(product.costPrice) : 0;
    return { ...g, upgradeSelected, quantity, product, configuredLedWattage, systemFactor, existingSystemWattage, effectiveBaselineWattage, dimmingPercent, profileHoursTotal: positive(g.existingFullPowerHours) + positive(g.existingReducedHours), nominalSystemKwh: groupNominalSystemKwh, existingDimmingSavingKwh: groupExistingDimmingSavingKwh, baselineKwh: groupBaseline, proposedLedKwh, ledKwh: groupLed, salesTotal: upgradeSelected ? quantity * sale : 0 };
  });
  const lcuQuantity = smartEnabled ? smartQuantity : 0;
  const cloSavingKwh = cmsEnabled ? smartLedKwh * positive(a.cloPercent) / 100 : 0;
  const afterCloKwh = Math.max(0, ledKwh - cloSavingKwh);
  const powerAidEligibleAfterCloKwh = Math.max(0, powerAidLedKwh * (1 - positive(a.cloPercent) / 100));
  const powerAidSavingKwh = powerAidEnabled ? powerAidEligibleAfterCloKwh * positive(a.powerAidPercent) / 100 : 0;
  const finalKwh = Math.max(0, afterCloKwh - powerAidSavingKwh);
  const notUpgradedBaselineKwh = Math.max(0, baselineKwh - upgradedBaselineKwh);
  const upgradedFinalKwh = Math.max(0, upgradedLedKwh - cloSavingKwh - powerAidSavingKwh);
  const getSmart = (id) => smartById[id] || {};
  const price = (product, key = "salesPrice") => project.pricing.overrides[product.id]?.[key] ?? positive(product[key]);
  const lcu = getSmart(project.solution.lcuProductId), gateway = getSmart(project.solution.gatewayProductId);
  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);
  const panelEquipmentEnabled = smartEnabled && upgradedQuantity > 0 && Boolean(
    project.solution.panelEquipmentEnabled ?? (
      positive(project.solution.gatewayQuantity) || positive(project.solution.antennaQuantity) || positive(project.solution.meterQuantity)
    )
  );
  const gatewayQty = panelEquipmentEnabled ? positive(project.solution.gatewayQuantity) : 0;
  const antennaQty = panelEquipmentEnabled ? positive(project.solution.antennaQuantity) : 0;
  const meterQty = panelEquipmentEnabled ? positive(project.solution.meterQuantity) : 0;
  const smartHardwareCapex = lcuQuantity * price(lcu);
  const implementationCapex = lcuQuantity * price(lcu, "implementationSalesPrice");
  const gatewayCapex = gatewayQty * price(gateway), antennaCapex = antennaQty * price(antenna), meterCapex = meterQty * price(meter);
  const freight = upgradedQuantity * positive(a.freightSalesPerLamp);
  const smartHardwareCost = lcuQuantity * positive(lcu.costPrice);
  const implementationCost = lcuQuantity * positive(lcu.implementationCost);
  const gatewayCost = gatewayQty * positive(gateway.costPrice), antennaCost = antennaQty * positive(antenna.costPrice), meterCost = meterQty * positive(meter.costPrice);
  const freightCost = upgradedQuantity * positive(a.freightCostPerLamp);
  const capexDirectCost = ledCost + smartHardwareCost + implementationCost + gatewayCost + antennaCost + meterCost + freightCost;
  const calculatedCapex = ledCapex + smartHardwareCapex + implementationCapex + gatewayCapex + antennaCapex + meterCapex + freight;
  const totalCapex = positive(a.officialOfferCapex) || calculatedCapex;
  const cmsRevenue = cmsEnabled ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;
  const gatewayRecurringRevenue = smartEnabled ? gatewayQty * price(gateway, "annualSalesPrice") : 0;
  const energySaving = (baselineKwh - finalKwh) * positive(a.energyPrice);
  const ledSavingKwh = Math.max(0, baselineKwh - ledKwh);
  const powerAidGrossSaving = powerAidEnabled ? powerAidSavingKwh * positive(a.energyPrice) : 0;
  const powerAidCustomerFee = powerAidEnabled ? powerAidGrossSaving * positive(a.powerAidCustomerFeePercent) / 100 : 0;
  const powerAidSupplierCost = powerAidEnabled ? powerAidCustomerFee * positive(a.powerAidSupplierSharePercent) / 100 : 0;
  const powerAidVimaluxMargin = powerAidCustomerFee - powerAidSupplierCost;
  const powerAidMarginPct = powerAidCustomerFee ? powerAidVimaluxMargin / powerAidCustomerFee * 100 : 0;
  const savingsAsAServiceRevenue = powerAidCustomerFee;
  const recurringOpex = cmsRevenue + gatewayRecurringRevenue;
  const calculatedAnnualRecurringRevenue = recurringOpex + savingsAsAServiceRevenue;
  const annualRecurringRevenue = positive(a.officialAnnualOpex) || calculatedAnnualRecurringRevenue;
  const cmsDirectCost = cmsEnabled ? lcuQuantity * positive(lcu.annualCost) : 0;
  const gatewayRecurringCost = smartEnabled ? gatewayQty * positive(gateway.annualCost) : 0;
  const annualOpexDirectCost = cmsDirectCost + gatewayRecurringCost;
  const totalAnnualOpex = annualRecurringRevenue;
  const fixedAnnualOpex = Math.max(0, totalAnnualOpex - powerAidCustomerFee);
  const powerAidCustomerNetBenefit = Math.max(0, powerAidGrossSaving - powerAidCustomerFee);
  const maintenanceSaving = upgradedQuantity * Math.max(0, positive(a.existingMaintenance) - positive(a.newMaintenance));
  const grossBenefit = energySaving + maintenanceSaving;
  const legacyDealType = a.financingModel === "finance" ? "finance" : ["laas", "ppp"].includes(a.financingModel) ? "noleggio_operativo" : "cash";
  const dealType = ["cash", "noleggio_operativo", "finance"].includes(a.dealType) ? a.dealType : legacyDealType;
  const hardwareFinanced = dealType === "finance" || dealType === "noleggio_operativo";
  const serviceAgreementPeriod = Math.max(1, Math.round((positive(a.serviceAgreementPeriod) !== 10 ? positive(a.serviceAgreementPeriod) : positive(a.contractYears)) || 10));
  const financingPeriod = Math.max(1, Math.round((positive(a.financingPeriod) !== 5 ? positive(a.financingPeriod) : positive(a.financingYears)) || 5));
  const contractYears = serviceAgreementPeriod;
  const financingYears = financingPeriod;
  const principal = Math.max(0, totalCapex - positive(a.upfrontPayment));
  const months = financingYears * 12;
  const monthlyRate = positive(a.interestRate) / 1200;
  const financingMonthlyPayment = hardwareFinanced ? (monthlyRate ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)) : principal / months) : 0;
  const financingAnnualPayment = financingMonthlyPayment * 12;
  const configuredAllInclusiveAnnualPayment = positive(a.allInclusiveAnnualPayment);
  const allInclusiveAnnualPayment = dealType === "noleggio_operativo" ? (configuredAllInclusiveAnnualPayment || financingAnnualPayment + totalAnnualOpex) : 0;
  const customerAnnualPayment = dealType === "noleggio_operativo" ? allInclusiveAnnualPayment : dealType === "finance" ? financingAnnualPayment + totalAnnualOpex : totalAnnualOpex;
  const monthlyPayment = customerAnnualPayment / 12;
  const annualPayment = customerAnnualPayment;
  const customerAnnualNetBenefit = grossBenefit - customerAnnualPayment;
  const escalatingTotal = (annual, rate, years = serviceAgreementPeriod) => Array.from({ length: years }, (_, index) => annual * Math.pow(1 + n(rate) / 100, index)).reduce((sum, value) => sum + value, 0);
  const financedHardwareTotal = positive(a.upfrontPayment) + financingAnnualPayment * financingYears;
  const fixedAnnualServiceRevenue = fixedAnnualOpex;
  const powerAidContractRevenue = Array.from({ length: serviceAgreementPeriod }, (_, index) => powerAidCustomerFee * Math.pow(1 + n(a.energyEscalation) / 100, index)).reduce((sum, value) => sum + value, 0);
  const contractOpexRevenue = dealType === "noleggio_operativo" ? 0 : escalatingTotal(fixedAnnualServiceRevenue, a.opexEscalation) + powerAidContractRevenue;
  const powerAidSupplierContractCost = Array.from({ length: serviceAgreementPeriod }, (_, index) => powerAidSupplierCost * Math.pow(1 + n(a.energyEscalation) / 100, index)).reduce((sum, value) => sum + value, 0);
  const contractOpexCost = escalatingTotal(annualOpexDirectCost, a.opexEscalation) + powerAidSupplierContractCost;
  const capexContractRevenue = dealType === "cash" ? totalCapex : dealType === "finance" ? financedHardwareTotal : 0;
  const allInclusiveContractRevenue = dealType === "noleggio_operativo" ? positive(a.upfrontPayment) + allInclusiveAnnualPayment * contractYears : 0;
  const totalContractRevenue = dealType === "noleggio_operativo" ? allInclusiveContractRevenue : capexContractRevenue + contractOpexRevenue;
  const dutyCost = positive(a.dutyCost);
  const commissionableLampSales = Math.max(0, ledCapex - freightCost - dutyCost);
  const agent1CommissionCost = commissionableLampSales * positive(a.agent1CommissionPercent) / 100;
  const agent2CommissionCost = commissionableLampSales * positive(a.agent2CommissionPercent) / 100;
  const commissionCost = agent1CommissionCost + agent2CommissionCost;
  const warrantyReserve = totalCapex * positive(a.warrantyReservePercent) / 100;
  const fundingRate = positive(a.fundingCostPercent) / 1200;
  const fundingPayment = hardwareFinanced ? (fundingRate ? principal * fundingRate / (1 - Math.pow(1 + fundingRate, -months)) : principal / months) : 0;
  const financingCost = hardwareFinanced ? Math.max(0, fundingPayment * months - principal) : 0;
  const totalDirectCosts = capexDirectCost + dutyCost + contractOpexCost + commissionCost + warrantyReserve + financingCost + positive(a.otherDirectCosts);
  const netProjectProfit = totalContractRevenue - totalDirectCosts;
  const netProjectMarginPercent = totalContractRevenue ? netProjectProfit / totalContractRevenue * 100 : 0;
  const analysisPeriod = Math.max(1, Math.round(positive(a.analysisPeriod)));
  let cumulative = hardwareFinanced ? -positive(a.upfrontPayment) : -totalCapex, npv = cumulative;
  const cashFlowRows = [];
  const customerValueRows = [];
  let contractedSavingsTotal = cumulative, fullSmartSavingsTotal = cumulative;
  let contractedGrossBenefitTotal = 0, fullSmartGrossBenefitTotal = 0, fullSmartExtensionServiceCost = 0;
  for (let year = 1; year <= analysisPeriod; year += 1) {
    const energyGrowth = Math.pow(1 + n(a.energyEscalation) / 100, year - 1);
    const opexGrowth = Math.pow(1 + n(a.opexEscalation || a.energyEscalation) / 100, year - 1);
    const serviceActive = year <= serviceAgreementPeriod;
    const annualLedEnergySaving = ledSavingKwh * positive(a.energyPrice) * energyGrowth;
    const annualCloEnergySaving = cmsEnabled && serviceActive ? cloSavingKwh * positive(a.energyPrice) * energyGrowth : 0;
    const annualPowerAidGrossSaving = powerAidEnabled && serviceActive ? powerAidGrossSaving * energyGrowth : 0;
    const benefit = annualLedEnergySaving + annualCloEnergySaving + annualPowerAidGrossSaving + maintenanceSaving;
    const annualPowerAidCustomerFee = powerAidEnabled && serviceActive ? annualPowerAidGrossSaving * positive(a.powerAidCustomerFeePercent) / 100 : 0;
    const annualPowerAidSupplierCost = annualPowerAidCustomerFee * positive(a.powerAidSupplierSharePercent) / 100;
    const fixedServiceOpex = Math.max(0, totalAnnualOpex - powerAidCustomerFee);
    const opex = year <= serviceAgreementPeriod ? fixedServiceOpex * opexGrowth + annualPowerAidCustomerFee : 0;
    const payment = dealType === "noleggio_operativo"
      ? (year <= contractYears ? allInclusiveAnnualPayment : 0)
      : dealType === "finance"
        ? (year <= financingYears ? financingAnnualPayment : 0)
        : 0;
    const serviceOpex = dealType === "noleggio_operativo" ? 0 : opex;
    const netCashFlow = benefit - serviceOpex - payment;
    const currentOperatingCost = baselineKwh * positive(a.energyPrice) * energyGrowth + totalQuantity * positive(a.existingMaintenance);
    const futureOperatingCost = Math.max(0, currentOperatingCost - benefit);
    const fullSmartCloSaving = cmsEnabled ? cloSavingKwh * positive(a.energyPrice) * energyGrowth : 0;
    const fullSmartPowerAidGrossSaving = powerAidEnabled ? powerAidGrossSaving * energyGrowth : 0;
    const fullSmartBenefit = annualLedEnergySaving + fullSmartCloSaving + fullSmartPowerAidGrossSaving + maintenanceSaving;
    const fullSmartPowerAidFee = powerAidEnabled ? fullSmartPowerAidGrossSaving * positive(a.powerAidCustomerFeePercent) / 100 : 0;
    const fullSmartOpex = fixedServiceOpex * opexGrowth + fullSmartPowerAidFee;
    const fullSmartServicePayment = serviceActive ? serviceOpex : fullSmartOpex;
    const fullSmartNetBenefit = fullSmartBenefit - fullSmartServicePayment - payment;
    contractedSavingsTotal += netCashFlow;
    fullSmartSavingsTotal += fullSmartNetBenefit;
    contractedGrossBenefitTotal += benefit;
    fullSmartGrossBenefitTotal += fullSmartBenefit;
    fullSmartExtensionServiceCost += Math.max(0, fullSmartServicePayment - serviceOpex);
    cumulative += netCashFlow;
    npv += netCashFlow / Math.pow(1 + n(a.discountRate) / 100, year);
    cashFlowRows.push({ year, grossBenefit: benefit, ledEnergySavingEUR: annualLedEnergySaving, cloSavingEUR: annualCloEnergySaving, opex, serviceOpex, payment, financePayment: dealType === "finance" ? payment : 0, contractedCustomerPayment: serviceOpex + payment, powerAidGrossSavingEUR: annualPowerAidGrossSaving, powerAidCustomerFee: annualPowerAidCustomerFee, powerAidSupplierCost: annualPowerAidSupplierCost, powerAidVimaluxMargin: annualPowerAidCustomerFee - annualPowerAidSupplierCost, netCashFlow, cumulative });
    customerValueRows.push({ year, currentOperatingCost, futureOperatingCost, investmentPayment: payment, servicePayment: serviceOpex, customerSaving: netCashFlow, fullSmartNetBenefit, fullSmartBenefit, fullSmartOpex });
  }
  const annualOperationalBenefit = grossBenefit - totalAnnualOpex;
  const payback = annualOperationalBenefit > 0 ? totalCapex / annualOperationalBenefit : null;
  const roiPercent = totalCapex > 0 ? annualOperationalBenefit / totalCapex * 100 : 0;
  const lifecycleResult = cumulative;
  const energyReductionPercent = baselineKwh ? (baselineKwh - finalKwh) / baselineKwh * 100 : 0;
  const upgradedEnergyReductionPercent = upgradedBaselineKwh ? (upgradedBaselineKwh - upgradedFinalKwh) / upgradedBaselineKwh * 100 : 0;
  const co2ReductionKg = (baselineKwh - finalKwh) * positive(a.co2KgPerKwh);
  const customerDecisionStatus = npv > 0 && customerAnnualNetBenefit >= 0 ? "GO" : npv > 0 || customerAnnualNetBenefit >= 0 ? "REVIEW" : "NO_GO";
  const minimumMarginPercent = positive(a.minimumMarginPercent || 30);
  const decisionStatus = netProjectMarginPercent >= minimumMarginPercent && customerDecisionStatus === "GO" ? "GO" : netProjectMarginPercent >= 20 && customerDecisionStatus !== "NO_GO" ? "REVIEW" : "NO_GO";
  return { totalQuantity, upgradedQuantity, notUpgradedQuantity: Math.max(0, totalQuantity - upgradedQuantity), smartQuantity, lcuQuantity, nominalSystemKwh, existingDimmingSavingKwh, baselineKwh, upgradedBaselineKwh, notUpgradedBaselineKwh, upgradedLedKwh, upgradedFinalKwh, ledKwh, ledSavingKwh, cloSavingKwh, afterCloKwh, powerAidSavingKwh, finalKwh,
    ledCapex, ledCost, smartHardwareCapex, implementationCapex, gatewayCapex, antennaCapex, meterCapex, freight, calculatedCapex, totalCapex, calculatedAnnualRecurringRevenue,
    cmsOpex: cmsRevenue, cmsRevenue, gatewayOpex: gatewayRecurringRevenue, gatewayRecurringRevenue, powerAidFee: powerAidCustomerFee, powerAidGrossSavingEUR: powerAidGrossSaving, powerAidCustomerFee, powerAidCustomerNetBenefit, powerAidSupplierCost, powerAidVimaluxMargin, powerAidMarginPct, powerAidContractRevenue, powerAidSupplierContractCost, powerAidVimaluxContractMargin: powerAidContractRevenue - powerAidSupplierContractCost, savingsAsAServiceRevenue, recurringOpex, annualRecurringRevenue, fixedAnnualOpex, cmsDirectCost, gatewayRecurringCost, totalAnnualOpex, energySaving, energySavingWithoutPowerAid: energySaving - powerAidGrossSaving, maintenanceSaving, grossBenefit, monthlyPayment, annualPayment,
    dealType, financingYears, financingPeriod, serviceAgreementPeriod, interestRateSnapshot: a.interestRateSnapshot || null, financingMonthlyPayment, financingAnnualPayment, allInclusiveAnnualPayment, allInclusiveContractRevenue, customerAnnualPayment, customerMonthlyPayment: monthlyPayment, customerPaymentYear1: dealType === "cash" ? totalCapex + totalAnnualOpex : positive(a.upfrontPayment) + customerAnnualPayment,
    customerAnnualNetBenefit, payback, roiPercent, npv, lifecycleResult, analysisPeriod, energyReductionPercent, upgradedEnergyReductionPercent, co2ReductionKg, decisionStatus, customerDecisionStatus,
    smartHardwareCost, implementationCost, gatewayCost, antennaCost, meterCost, freightCost, dutyCost, capexDirectCost, annualOpexDirectCost, contractOpexRevenue, contractOpexCost, capexContractRevenue, totalContractRevenue, commissionableLampSales, agent1CommissionCost, agent2CommissionCost, commissionCost, warrantyReserve, financingCost, totalDirectCosts, netProjectProfit, netProjectMarginPercent, minimumMarginPercent,
    cashFlowRows, customerValueRows, contractedSavingsTotal, fullSmartSavingsTotal, contractedGrossBenefitTotal, fullSmartGrossBenefitTotal, fullSmartAdditionalGrossSavings: fullSmartGrossBenefitTotal - contractedGrossBenefitTotal, fullSmartExtensionServiceCost, fullSmartIncrementalSavings: fullSmartSavingsTotal - contractedSavingsTotal, groupRows, hardware: { lcu, gateway, antenna, meter, gatewayQty, antennaQty, meterQty }, powerAidEnabled, cmsEnabled, smartEnabled };
}
