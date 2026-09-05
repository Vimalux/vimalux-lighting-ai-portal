const n = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const positive = (value) => Math.max(0, n(value));

export function hybridWeightStatus(weightKg) {
  const weight = positive(weightKg);
  if (!weight) return "unknown";
  if (weight > 18) return "fail";
  if (weight >= 18) return "warning";
  return "ok";
}

export function calculateHybridSolar(project = {}) {
  const products = Array.isArray(project?.catalogue?.led) ? project.catalogue.led : [];
  const byId = Object.fromEntries(products.map((product) => [product.id, product]));
  const groups = Array.isArray(project?.groups) ? project.groups : [];
  const operatingHours = positive(project?.assumptions?.operatingHours);
  const energyPrice = positive(project?.assumptions?.energyPrice);
  const solarYieldKwhPerKwp = positive(project?.assumptions?.hybridSolarYieldKwhPerKwp);

  const rows = groups.flatMap((group) => {
    if (group?.upgradeSelected === false) return [];
    const product = byId[group?.proposedProductId];
    if (!product?.hybrid) return [];

    const quantity = positive(group?.quantity);
    const pvWp = positive(product?.pvWp);
    const batteryWh = positive(product?.batteryWh);
    const usableBatteryWh = positive(product?.usableBatteryWh) || batteryWh * 0.9;
    const solarModeW = positive(product?.solarModeW) || positive(group?.projectLedWattage) || positive(product?.wattage);
    const roundtrip = Math.min(1, Math.max(0, positive(product?.batteryRoundtripEfficiencyPercent || 90) / 100));
    const annualPvKwh = solarYieldKwhPerKwp > 0 ? quantity * (pvWp / 1000) * solarYieldKwhPerKwp : 0;
    const annualSolarLoadKwh = quantity * solarModeW * operatingHours / 1000;
    const annualBatteryThroughputKwh = quantity * (usableBatteryWh / 1000) * 365;
    const usableSolarKwh = Math.min(annualSolarLoadKwh, annualPvKwh * roundtrip, annualBatteryThroughputKwh);
    const annualGridSavingEur = usableSolarKwh * energyPrice;
    const batteryAutonomyHours = solarModeW > 0 ? usableBatteryWh / solarModeW : 0;

    return [{
      groupId: group.id,
      groupName: group.name || product.name || product.model || "Hybrid",
      productId: product.id,
      productName: product.model || product.name || product.id,
      supplier: product.supplier || "",
      quantity,
      pvWp,
      batteryWh,
      usableBatteryWh,
      solarModeW,
      batteryAutonomyHours,
      annualBatteryThroughputKwh,
      weightKg: positive(product.weightKg),
      weightStatus: hybridWeightStatus(product.weightKg),
      annualPvKwh,
      usableSolarKwh,
      annualGridSavingEur,
      solarYieldKwhPerKwp,
    }];
  });

  return {
    enabled: rows.length > 0,
    rows,
    solarYieldKwhPerKwp,
    totalHybridUnits: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalPvKwh: rows.reduce((sum, row) => sum + row.annualPvKwh, 0),
    totalUsableSolarKwh: rows.reduce((sum, row) => sum + row.usableSolarKwh, 0),
    totalGridSavingEur: rows.reduce((sum, row) => sum + row.annualGridSavingEur, 0),
    hasWeightFailure: rows.some((row) => row.weightStatus === "fail"),
    hasWeightWarning: rows.some((row) => row.weightStatus === "warning"),
  };
}
