export const V31_DEFAULT_GROUP = {
  id: "group-1",
  label: "Street lighting group",
  quantity: 100,
  existingType: "SAP",
  existingWatt: 100,
  productId: "street40",
  smart: true,
  powerAid: false,
  hybrid: false,
  recommendationConfidence: null,
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

export function normalizeTechnology(value = "") {
  const text = String(value).trim().toUpperCase();
  if (/SAP|HPS|SODIO|SODIUM/.test(text)) return "SAP";
  if (/METAL|MH|IODURI/.test(text)) return "MH";
  if (/MERCURY|MERCURIO|HG|VAPORI/.test(text)) return "MERCURY";
  if (/FLUOR|NEON/.test(text)) return "FLUORESCENT";
  if (/LED/.test(text)) return "LED";
  return "UNKNOWN";
}

export function getBallastFactor(existingType, assumptions = {}) {
  const technology = normalizeTechnology(existingType);
  const factors = {
    SAP: num(assumptions.sapBallastFactor || 1.2),
    MH: num(assumptions.mhBallastFactor || 1.15),
    MERCURY: num(assumptions.mercuryBallastFactor || 1.15),
    FLUORESCENT: num(assumptions.fluorescentBallastFactor || 1.1),
    LED: num(assumptions.ledBallastFactor || 1),
    UNKNOWN: num(assumptions.unknownBallastFactor || 1),
  };
  return Math.max(0, factors[technology] || 1);
}

const SAP_LED_REFERENCE = [
  [50, 20],
  [70, 30],
  [100, 40],
  [150, 60],
  [250, 90],
  [400, 150],
];

function interpolateReference(existingWatt, table) {
  if (!table.length) return 0;
  if (existingWatt <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i += 1) {
    const [highInput, highOutput] = table[i];
    const [lowInput, lowOutput] = table[i - 1];
    if (existingWatt <= highInput) {
      const ratio = (existingWatt - lowInput) / (highInput - lowInput);
      return lowOutput + ratio * (highOutput - lowOutput);
    }
  }
  const [lastInput, lastOutput] = table[table.length - 1];
  return lastOutput * (existingWatt / lastInput);
}

export function recommendLedWattage(existingType, existingWatt) {
  const technology = normalizeTechnology(existingType);
  const watt = Math.max(0, num(existingWatt));
  if (!watt) return { targetWatt: 0, confidence: 0, method: "missing-input" };

  let targetWatt;
  let confidence;
  let method;

  if (technology === "SAP") {
    targetWatt = interpolateReference(watt, SAP_LED_REFERENCE);
    confidence = 85;
    method = "sap-reference-table";
  } else if (technology === "MH" || technology === "MERCURY") {
    targetWatt = watt * 0.42;
    confidence = 70;
    method = "legacy-discharge-ratio";
  } else if (technology === "FLUORESCENT") {
    targetWatt = watt * 0.55;
    confidence = 65;
    method = "fluorescent-ratio";
  } else if (technology === "LED") {
    targetWatt = watt;
    confidence = 45;
    method = "existing-led-review";
  } else {
    targetWatt = watt * 0.45;
    confidence = 40;
    method = "unknown-technology-estimate";
  }

  return {
    targetWatt: Math.max(1, Math.round(targetWatt)),
    confidence,
    method,
  };
}

export function recommendProduct(existingType, existingWatt, products = []) {
  const recommendation = recommendLedWattage(existingType, existingWatt);
  const candidates = products.filter((product) => num(product.watt) > 0);
  if (!candidates.length) return { ...recommendation, productId: "", product: null };

  const product = candidates.reduce((best, candidate) => {
    const currentDistance = Math.abs(num(candidate.watt) - recommendation.targetWatt);
    const bestDistance = Math.abs(num(best.watt) - recommendation.targetWatt);
    return currentDistance < bestDistance ? candidate : best;
  });

  return { ...recommendation, productId: product.id, product };
}

export function calculateManualGroup(group, assumptions, product) {
  const quantity = Math.max(0, num(group.quantity));
  const nominalExistingWatt = Math.max(0, num(group.existingWatt));
  const ballastFactor = getBallastFactor(group.existingType, assumptions);
  const effectiveExistingWatt = nominalExistingWatt * ballastFactor;
  const newLedWatt = Math.max(0, num(product?.watt));
  const burningHours = Math.max(0, num(assumptions.burningHours));
  const energyPrice = Math.max(0, num(assumptions.energyPrice));

  const baselineKwh = (quantity * effectiveExistingWatt * burningHours) / 1000;
  const remainingKwhAfterLed = (quantity * newLedWatt * burningHours) / 1000;
  const ledEnergySavingKwh = Math.max(0, baselineKwh - remainingKwhAfterLed);

  const cloSavingKwh = group.smart ? remainingKwhAfterLed * pct(assumptions.cloSavingPct) : 0;
  const remainingKwhAfterClo = Math.max(0, remainingKwhAfterLed - cloSavingKwh);
  const smartProfileSavingKwh = group.smart ? remainingKwhAfterClo * pct(assumptions.smartSolutionSavingPct) : 0;
  const remainingKwhAfterSmart = Math.max(0, remainingKwhAfterClo - smartProfileSavingKwh);
  const powerAidSavingKwh = group.smart && group.powerAid
    ? remainingKwhAfterSmart * pct(assumptions.powerAidAdditionalSavingPct)
    : 0;
  const remainingKwhAfterPowerAid = Math.max(0, remainingKwhAfterSmart - powerAidSavingKwh);

  const hybridPotentialKwh = group.hybrid
    ? quantity * num(assumptions.hybridProductionKwhPerLampYear || 70)
    : 0;
  const hybridSavingKwh = Math.min(remainingKwhAfterPowerAid, Math.max(0, hybridPotentialKwh));
  const totalEnergySavingKwh = Math.min(
    baselineKwh,
    ledEnergySavingKwh + cloSavingKwh + smartProfileSavingKwh + powerAidSavingKwh + hybridSavingKwh
  );
  const residualGridKwh = Math.max(0, baselineKwh - totalEnergySavingKwh);
  const baselineEnergyCost = baselineKwh * energyPrice;
  const totalEnergySavingValue = totalEnergySavingKwh * energyPrice;

  const maintenanceSaving = group.smart
    ? quantity * num(assumptions.maintenanceOldPerLamp) * pct(assumptions.maintenanceSavingPct)
    : 0;
  const cmsOpex = group.smart ? quantity * num(assumptions.cmsFeePerLampYear) : 0;
  const powerAidOpex = group.smart && group.powerAid
    ? quantity * num(assumptions.powerAidFeePerLampYear)
    : 0;
  const recurringOpex = cmsOpex + powerAidOpex;

  const luminaireCapex = quantity * num(product?.sellPrice);
  const installationCapex = quantity * num(product?.install);
  const smartCapex = group.smart ? quantity * num(assumptions.smartNodeCost) : 0;
  const hybridCapex = group.hybrid
    ? quantity * num(assumptions.hybridAdditionalCapexPerLamp || 0)
    : 0;
  const totalCapex = luminaireCapex + installationCapex + smartCapex + hybridCapex;
  const annualNetSaving = totalEnergySavingValue + maintenanceSaving - recurringOpex;

  return {
    groupId: group.id,
    quantity,
    productId: product?.id || group.productId,
    nominalExistingWatt,
    ballastFactor,
    effectiveExistingWatt,
    newLedWatt,
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
    energyReductionPct: baselineKwh > 0 ? (totalEnergySavingKwh / baselineKwh) * 100 : 0,
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
  return cashFlows.reduce((total, cashFlow, year) => total + cashFlow / Math.pow(1 + rate, year), 0);
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
    const indexedSaving = totals.annualNetSaving * Math.pow(1 + indexation, year - 1) * Math.pow(1 - degradation, year - 1);
    cumulative += indexedSaving;
    cashFlows.push(indexedSaving);
    yearly.push({ year, netSaving: indexedSaving, cumulative });
  }
  const npv = calculateNpv(cashFlows, discountRate);
  const irr = calculateIrr(cashFlows);
  const netBenefit = cashFlows.reduce((sum, value) => sum + value, 0);
  const roiPct = totals.totalCapex > 0 ? (netBenefit / totals.totalCapex) * 100 : 0;
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
    lifetimeCo2Tonnes: yearly.reduce(
      (sum, row, index) => sum + (totals.totalEnergySavingKwh * Math.pow(1 - degradation, index) * co2KgPerKwh) / 1000,
      0
    ),
  };
}

export function calculateManualProject(groups, assumptions, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const groupResults = groups.map((group) => calculateManualGroup(group, assumptions, productMap.get(group.productId)));
  const totalKeys = [
    "quantity", "baselineKwh", "baselineEnergyCost", "residualGridKwh", "ledEnergySavingKwh",
    "cloSavingKwh", "smartProfileSavingKwh", "powerAidSavingKwh", "hybridSavingKwh",
    "totalEnergySavingKwh", "totalEnergySavingValue", "maintenanceSaving", "recurringOpex",
    "luminaireCapex", "installationCapex", "smartCapex", "hybridCapex", "totalCapex", "annualNetSaving"
  ];
  const totals = Object.fromEntries(totalKeys.map((key) => [key, 0]));
  groupResults.forEach((result) => totalKeys.forEach((key) => { totals[key] += num(result[key]); }));
  totals.energyReductionPct = totals.baselineKwh > 0 ? (totals.totalEnergySavingKwh / totals.baselineKwh) * 100 : 0;
  totals.payback = totals.annualNetSaving > 0 ? totals.totalCapex / totals.annualNetSaving : null;
  const finance = calculateProjectFinance(totals, assumptions);
  return { groups: groupResults, totals, finance };
}

export function auditRowsToManualGroups(rows, products) {
  return rows
    .filter((row) => num(row.quantity) > 0 && num(row.existingWatt) > 0)
    .map((row, index) => {
      const recommendation = recommendProduct(row.existingType, row.existingWatt, products);
      return createManualGroup(index + 1, {
        label: row.label || `Audit group ${index + 1}`,
        quantity: num(row.quantity),
        existingType: row.existingType || "Unknown",
        existingWatt: num(row.existingWatt),
        productId: row.productId || recommendation.productId || products[0]?.id || "",
        recommendationTargetWatt: recommendation.targetWatt,
        recommendationConfidence: recommendation.confidence,
        recommendationMethod: recommendation.method,
        smart: true,
        powerAid: false,
        hybrid: false,
      });
    });
}
