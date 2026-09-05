const n = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const positive = (value) => Math.max(0, n(value));
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MID_MONTH_DAY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

export function hybridWeightStatus(weightKg) {
  const weight = positive(weightKg);
  if (!weight) return "unknown";
  if (weight > 18) return "fail";
  if (weight >= 18) return "warning";
  return "ok";
}

export function monthlyOperatingHours(annualOperatingHours, latitude = 45) {
  const annual = positive(annualOperatingHours);
  if (!annual) return Array(12).fill(0);
  const lat = Math.max(-66, Math.min(66, n(latitude) || 45)) * Math.PI / 180;
  const raw = MID_MONTH_DAY.map((day, index) => {
    const declination = 23.44 * Math.PI / 180 * Math.sin((2 * Math.PI / 365) * (day - 81));
    const cosHourAngle = Math.max(-1, Math.min(1, -Math.tan(lat) * Math.tan(declination)));
    const dayLength = 24 / Math.PI * Math.acos(cosHourAngle);
    const nightLength = 24 - dayLength;
    return nightLength * MONTH_DAYS[index];
  });
  const total = raw.reduce((sum, value) => sum + value, 0) || 1;
  return raw.map((value) => annual * value / total);
}

export function calculateHybridSolar(project = {}) {
  const products = Array.isArray(project?.catalogue?.led) ? project.catalogue.led : [];
  const byId = Object.fromEntries(products.map((product) => [product.id, product]));
  const groups = Array.isArray(project?.groups) ? project.groups : [];
  const operatingHours = positive(project?.assumptions?.operatingHours);
  const energyPrice = positive(project?.assumptions?.energyPrice);
  const location = project?.assumptions?.hybridSolarLocation || {};
  const monthlyProfile = Array.isArray(location?.monthlyYieldKwhPerKwp) && location.monthlyYieldKwhPerKwp.length === 12
    ? location.monthlyYieldKwhPerKwp.map(positive)
    : null;
  const profileAnnualYield = monthlyProfile ? monthlyProfile.reduce((sum, value) => sum + value, 0) : 0;
  const solarYieldKwhPerKwp = profileAnnualYield || positive(project?.assumptions?.hybridSolarYieldKwhPerKwp);
  const latitude = Number.isFinite(Number(location?.latitude)) ? Number(location.latitude) : 45;
  const monthHours = monthlyOperatingHours(operatingHours, latitude);

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
    const annualSolarLoadKwh = quantity * solarModeW * operatingHours / 1000;
    const annualBatteryThroughputKwh = quantity * (usableBatteryWh / 1000) * 365;
    const batteryAutonomyHours = solarModeW > 0 ? usableBatteryWh / solarModeW : 0;

    const monthly = monthlyProfile ? monthlyProfile.map((yieldValue, index) => {
      const pvKwh = quantity * (pvWp / 1000) * yieldValue;
      const loadKwh = quantity * solarModeW * monthHours[index] / 1000;
      const batteryThroughputKwh = quantity * (usableBatteryWh / 1000) * MONTH_DAYS[index];
      const usableSolarKwh = Math.min(loadKwh, pvKwh * roundtrip, batteryThroughputKwh);
      return {
        month: index + 1,
        days: MONTH_DAYS[index],
        operatingHours: monthHours[index],
        yieldKwhPerKwp: yieldValue,
        pvKwh,
        loadKwh,
        usableSolarKwh,
        gridSavingEur: usableSolarKwh * energyPrice,
        contributionPercent: loadKwh > 0 ? usableSolarKwh / loadKwh * 100 : 0,
      };
    }) : [];

    const annualPvKwh = monthly.length
      ? monthly.reduce((sum, item) => sum + item.pvKwh, 0)
      : (solarYieldKwhPerKwp > 0 ? quantity * (pvWp / 1000) * solarYieldKwhPerKwp : 0);
    const usableSolarKwh = monthly.length
      ? monthly.reduce((sum, item) => sum + item.usableSolarKwh, 0)
      : Math.min(annualSolarLoadKwh, annualPvKwh * roundtrip, annualBatteryThroughputKwh);
    const annualGridSavingEur = usableSolarKwh * energyPrice;

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
      annualSolarLoadKwh,
      weightKg: positive(product.weightKg),
      weightStatus: hybridWeightStatus(product.weightKg),
      annualPvKwh,
      usableSolarKwh,
      annualGridSavingEur,
      solarYieldKwhPerKwp,
      annualContributionPercent: annualSolarLoadKwh > 0 ? usableSolarKwh / annualSolarLoadKwh * 100 : 0,
      monthly,
    }];
  });

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
    const items = rows.map((row) => row.monthly?.[index]).filter(Boolean);
    const pvKwh = items.reduce((sum, item) => sum + item.pvKwh, 0);
    const loadKwh = items.reduce((sum, item) => sum + item.loadKwh, 0);
    const usableSolarKwh = items.reduce((sum, item) => sum + item.usableSolarKwh, 0);
    return {
      month: index + 1,
      yieldKwhPerKwp: monthlyProfile?.[index] || 0,
      pvKwh,
      loadKwh,
      usableSolarKwh,
      gridSavingEur: usableSolarKwh * energyPrice,
      contributionPercent: loadKwh > 0 ? usableSolarKwh / loadKwh * 100 : 0,
    };
  });

  const totalSolarLoadKwh = rows.reduce((sum, row) => sum + row.annualSolarLoadKwh, 0);
  const totalUsableSolarKwh = rows.reduce((sum, row) => sum + row.usableSolarKwh, 0);

  return {
    enabled: rows.length > 0,
    rows,
    location,
    dataLevel: monthlyProfile ? (location?.dataLevel || "municipality") : "manual",
    solarYieldKwhPerKwp,
    monthlyTotals,
    hasMonthlyProfile: Boolean(monthlyProfile),
    totalHybridUnits: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalPvKwh: rows.reduce((sum, row) => sum + row.annualPvKwh, 0),
    totalSolarLoadKwh,
    totalUsableSolarKwh,
    totalGridSavingEur: rows.reduce((sum, row) => sum + row.annualGridSavingEur, 0),
    totalContributionPercent: totalSolarLoadKwh > 0 ? totalUsableSolarKwh / totalSolarLoadKwh * 100 : 0,
    hasWeightFailure: rows.some((row) => row.weightStatus === "fail"),
    hasWeightWarning: rows.some((row) => row.weightStatus === "warning"),
  };
}
