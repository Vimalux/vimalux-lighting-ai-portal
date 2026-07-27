export const V31_DEFAULT_GROUP = {
  id: "group-1",
  label: "Street lighting group",
  quantity: 100,
  existingType: "SAP",
  existingWatt: 100,
  productId: "street60",
  smart: true,
  powerAid: false,
  hybrid: false,
};

export function createManualGroup(index = 1, overrides = {}) {
  return {
    ...V31_DEFAULT_GROUP,
    id: `group-${Date.now()}-${index}`,
    label: `Group ${index}`,
    ...overrides,
  };
}

function num(value) {
  if (value === "" || value === null || value === undefined) return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

function pct(value) {
  return Math.min(100, Math.max(0, num(value))) / 100;
}

export function calculateManualGroup(group, assumptions, product) {
  const quantity = Math.max(0, num(group.quantity));
  const existingWatt = Math.max(0, num(group.existingWatt));
  const burningHours = Math.max(0, num(assumptions.burningHours));
  const energyPrice = Math.max(0, num(assumptions.energyPrice));

  const baselineKwh = (quantity * existingWatt * burningHours) / 1000;
  const baselineEnergyCost = baselineKwh * energyPrice;

  const ledEnergySavingKwh = baselineKwh * pct(assumptions.ledSavingPct);
  const remainingKwhAfterLed = Math.max(0, baselineKwh - ledEnergySavingKwh);

  const cloSavingKwh = group.smart
    ? remainingKwhAfterLed * pct(assumptions.cloSavingPct)
    : 0;

  const remainingKwhAfterClo = Math.max(0, remainingKwhAfterLed - cloSavingKwh);

  const smartProfileSavingKwh = group.smart
    ? remainingKwhAfterClo * pct(assumptions.smartSolutionSavingPct)
    : 0;

  const remainingKwhAfterSmart = Math.max(
    0,
    remainingKwhAfterClo - smartProfileSavingKwh
  );

  // PowerAiD is a percentage of the remaining consumption after Smart.
  const powerAidSavingKwh = group.smart && group.powerAid
    ? remainingKwhAfterSmart * pct(assumptions.powerAidAdditionalSavingPct)
    : 0;

  const remainingKwhAfterPowerAid = Math.max(
    0,
    remainingKwhAfterSmart - powerAidSavingKwh
  );

  const hybridPotentialKwh = group.hybrid
    ? quantity * num(assumptions.hybridProductionKwhPerLampYear || 70)
    : 0;

  const hybridSavingKwh = Math.min(
    remainingKwhAfterPowerAid,
    Math.max(0, hybridPotentialKwh)
  );

  const totalEnergySavingKwh = Math.min(
    baselineKwh,
    ledEnergySavingKwh +
      cloSavingKwh +
      smartProfileSavingKwh +
      powerAidSavingKwh +
      hybridSavingKwh
  );

  const residualGridKwh = Math.max(0, baselineKwh - totalEnergySavingKwh);
  const totalEnergySavingValue = totalEnergySavingKwh * energyPrice;

  const maintenanceSaving = group.smart
    ? quantity *
      num(assumptions.maintenanceOldPerLamp) *
      pct(assumptions.maintenanceSavingPct)
    : 0;

  const cmsOpex = group.smart
    ? quantity * num(assumptions.cmsFeePerLampYear)
    : 0;

  const powerAidOpex = group.smart && group.powerAid
    ? quantity * num(assumptions.powerAidFeePerLampYear)
    : 0;

  const recurringOpex = cmsOpex + powerAidOpex;

  const luminaireCapex = quantity * num(product?.sellPrice);
  const installationCapex = quantity * num(product?.install);
  const smartCapex = group.smart
    ? quantity * num(assumptions.smartNodeCost)
    : 0;
  const hybridCapex = group.hybrid
    ? quantity * num(assumptions.hybridAdditionalCapexPerLamp || 0)
    : 0;

  const totalCapex =
    luminaireCapex + installationCapex + smartCapex + hybridCapex;

  const annualNetSaving =
    totalEnergySavingValue + maintenanceSaving - recurringOpex;

  return {
    groupId: group.id,
    quantity,
    productId: product?.id || group.productId,
    baselineKwh,
    baselineEnergyCost,
    residualGridKwh,
    ledEnergySavingKwh,
    cloSavingKwh,
    smartProfileSavingKwh,
    powerAidSavingKwh,
    hybridSavingKwh,
    totalEnergySavingKwh,
    totalEnergySavingValue,
    energyReductionPct:
      baselineKwh > 0 ? (totalEnergySavingKwh / baselineKwh) * 100 : 0,
    maintenanceSaving,
    recurringOpex,
    luminaireCapex,
    installationCapex,
    smartCapex,
    hybridCapex,
    totalCapex,
    annualNetSaving,
    payback: annualNetSaving > 0 ? totalCapex / annualNetSaving : null,
  };
}

function calculateNpv(cashFlows, discountRate) {
  const rate = num(discountRate) / 100;
  return cashFlows.reduce(
    (total, cashFlow, year) => total + cashFlow / Math.pow(1 + rate, year),
    0
  );
}

function calculateIrr(cashFlows) {
  const hasPositive = cashFlows.some((value) => value > 0);
  const hasNegative = cashFlows.some((value) => value < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.99;
  let high = 10;
  let lowNpv = calculateNpv(cashFlows, low * 100);

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const midpoint = (low + high) / 2;
    const midpointNpv = calculateNpv(cashFlows, midpoint * 100);

    if (Math.abs(midpointNpv) < 0.01) return midpoint * 100;

    if ((lowNpv > 0 && midpointNpv > 0) || (lowNpv < 0 && midpointNpv < 0)) {
      low = midpoint;
      lowNpv = midpointNpv;
    } else {
      high = midpoint;
    }
  }

  return ((low + high) / 2) * 100;
}

export function calculateProjectFinance(totals, assumptions) {
  const years = Math.max(1, Math.round(num(assumptions.analysisYears || 20)));
  const indexation = num(assumptions.savingIndexationPct || 1.5) / 100;
  const discountRate = num(assumptions.discountRatePct || 6);
  const degradation = num(assumptions.performanceDegradationPct || 0) / 100;
  const co2KgPerKwh = num(assumptions.co2KgPerKwh || 0.233);

  const cashFlows = [-totals.totalCapex];
  const yearly = [];
  let cumulative = -totals.totalCapex;

  for (let year = 1; year <= years; year += 1) {
    const indexedSaving =
      totals.annualNetSaving *
      Math.pow(1 + indexation, year - 1) *
      Math.pow(1 - degradation, year - 1);
    cumulative += indexedSaving;
    cashFlows.push(indexedSaving);
    yearly.push({ year, netSaving: indexedSaving, cumulative });
  }

  const npv = calculateNpv(cashFlows, discountRate);
  const irr = calculateIrr(cashFlows);
  const netBenefit = cashFlows.reduce((sum, value) => sum + value, 0);
  const roiPct = totals.totalCapex > 0
    ? (netBenefit / totals.totalCapex) * 100
    : 0;

  return {
    years,
    discountRate,
    cashFlows,
    yearly,
    npv,
    irr,
    netBenefit,
    roiPct,
    annualCo2Tonnes: (totals.totalEnergySavingKwh * co2KgPerKwh) / 1000,
    lifetimeCo2Tonnes:
      yearly.reduce(
        (sum, row, index) =>
          sum +
          (totals.totalEnergySavingKwh *
            Math.pow(1 - degradation, index) *
            co2KgPerKwh) /
            1000,
        0
      ),
  };
}

export function calculateManualProject(groups, assumptions, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  const groupResults = groups.map((group) =>
    calculateManualGroup(group, assumptions, productMap.get(group.productId))
  );

  const totals = groupResults.reduce(
    (acc, result) => {
      Object.keys(acc).forEach((key) => {
        acc[key] += num(result[key]);
      });
      return acc;
    },
    {
      quantity: 0,
      baselineKwh: 0,
      baselineEnergyCost: 0,
      residualGridKwh: 0,
      ledEnergySavingKwh: 0,
      cloSavingKwh: 0,
      smartProfileSavingKwh: 0,
      powerAidSavingKwh: 0,
      hybridSavingKwh: 0,
      totalEnergySavingKwh: 0,
      totalEnergySavingValue: 0,
      maintenanceSaving: 0,
      recurringOpex: 0,
      luminaireCapex: 0,
      installationCapex: 0,
      smartCapex: 0,
      hybridCapex: 0,
      totalCapex: 0,
      annualNetSaving: 0,
    }
  );

  totals.energyReductionPct =
    totals.baselineKwh > 0
      ? (totals.totalEnergySavingKwh / totals.baselineKwh) * 100
      : 0;
  totals.payback =
    totals.annualNetSaving > 0
      ? totals.totalCapex / totals.annualNetSaving
      : null;

  const finance = calculateProjectFinance(totals, assumptions);
  return { groups: groupResults, totals, finance };
}

export function auditRowsToManualGroups(rows, products) {
  const defaultProductId = products[0]?.id || "";

  return rows
    .filter((row) => num(row.quantity) > 0 && num(row.existingWatt) > 0)
    .map((row, index) =>
      createManualGroup(index + 1, {
        label: row.label || `Audit group ${index + 1}`,
        quantity: num(row.quantity),
        existingType: row.existingType || "Unknown",
        existingWatt: num(row.existingWatt),
        productId: row.productId || defaultProductId,
        smart: true,
        powerAid: false,
        hybrid: false,
      })
    );
}
