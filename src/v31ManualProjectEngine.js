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

export function calculateManualGroup(group, assumptions, product) {
  const quantity = Math.max(0, num(group.quantity));
  const existingWatt = Math.max(0, num(group.existingWatt));
  const burningHours = Math.max(0, num(assumptions.burningHours));
  const energyPrice = Math.max(0, num(assumptions.energyPrice));

  const baselineKwh = (quantity * existingWatt * burningHours) / 1000;
  const baselineEnergyCost = baselineKwh * energyPrice;

  // Commercial rule: LED Only is always the configured LED saving percentage.
  const ledEnergySavingKwh = baselineKwh * (num(assumptions.ledSavingPct) / 100);
  const ledEnergySavingValue = ledEnergySavingKwh * energyPrice;
  const remainingKwhAfterLed = Math.max(0, baselineKwh - ledEnergySavingKwh);

  const cloSavingKwh = group.smart
    ? remainingKwhAfterLed * (num(assumptions.cloSavingPct) / 100)
    : 0;

  const remainingKwhAfterClo = Math.max(0, remainingKwhAfterLed - cloSavingKwh);

  const smartProfileSavingKwh = group.smart
    ? remainingKwhAfterClo * (num(assumptions.smartSolutionSavingPct) / 100)
    : 0;

  const remainingKwhAfterSmart = Math.max(
    0,
    remainingKwhAfterClo - smartProfileSavingKwh
  );

  const powerAidSavingKwh = group.smart && group.powerAid
    ? remainingKwhAfterSmart *
      (num(assumptions.powerAidAdditionalSavingPct) / 100)
    : 0;

  const remainingKwhAfterPowerAid = Math.max(
    0,
    remainingKwhAfterSmart - powerAidSavingKwh
  );

  const hybridPotentialKwh = group.hybrid
    ? quantity * num(assumptions.hybridProductionKwhPerLampYear || 70)
    : 0;

  // Hybrid production cannot reduce grid consumption below zero.
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

  const totalEnergySavingValue = totalEnergySavingKwh * energyPrice;

  const maintenanceSaving = group.smart
    ? quantity *
      num(assumptions.maintenanceOldPerLamp) *
      (num(assumptions.maintenanceSavingPct) / 100)
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

  return { groups: groupResults, totals };
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
