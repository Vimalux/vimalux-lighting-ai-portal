import test from "node:test";
import assert from "node:assert/strict";
import { calculateHybridSolar, monthlyOperatingHours } from "../src/hybridSolar.js";
import { parsePvgisMonthly, stripMunicipalityPrefix } from "../src/solarLocation.js";

test("municipality prefix is removed without changing the name", () => {
  assert.equal(stripMunicipalityPrefix("Comune di Poggiardo"), "Poggiardo");
  assert.equal(stripMunicipalityPrefix("Poggiardo"), "Poggiardo");
});

test("PVGIS monthly rows are averaged into a 12 month profile", () => {
  const rows = [];
  for (let year = 2020; year <= 2021; year += 1) {
    for (let month = 1; month <= 12; month += 1) rows.push({ year, month, "H(h)_m": month * 10 + (year - 2020) * 2 });
  }
  const profile = parsePvgisMonthly({ outputs: { monthly: rows } });
  assert.equal(profile.length, 12);
  assert.equal(profile[0], 11);
  assert.equal(profile[11], 121);
});

test("monthly operating-hour allocation preserves annual hours and shifts more load to winter", () => {
  const hours = monthlyOperatingHours(4200, 40);
  const total = hours.reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 4200) < 1e-9);
  assert.ok(hours[0] > hours[6]);
});

test("municipality monthly profile drives hybrid contribution without changing non-hybrid groups", () => {
  const project = {
    assumptions: {
      operatingHours: 4200,
      energyPrice: 0.29,
      hybridSolarLocation: {
        dataLevel: "municipality",
        latitude: 40.05,
        longitude: 18.38,
        monthlyYieldKwhPerKwp: [55, 70, 100, 125, 150, 175, 190, 165, 125, 95, 60, 45],
      },
    },
    catalogue: {
      led: [
        { id: "hyb", name: "Hybrid 40", hybrid: true, pvWp: 60, batteryWh: 300, usableBatteryWh: 270, solarModeW: 40, batteryRoundtripEfficiencyPercent: 90, weightKg: 16 },
        { id: "led", name: "LED 40", hybrid: false, wattage: 40 },
      ],
    },
    groups: [
      { id: "g1", quantity: 10, proposedProductId: "hyb", upgradeSelected: true, projectLedWattage: 40 },
      { id: "g2", quantity: 100, proposedProductId: "led", upgradeSelected: true, projectLedWattage: 40 },
    ],
  };
  const result = calculateHybridSolar(project);
  assert.equal(result.enabled, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.totalHybridUnits, 10);
  assert.equal(result.hasMonthlyProfile, true);
  assert.equal(result.monthlyTotals.length, 12);
  assert.ok(result.totalPvKwh > 0);
  assert.ok(result.totalUsableSolarKwh > 0);
  assert.ok(result.totalContributionPercent > 0);
  assert.ok(result.monthlyTotals[6].yieldKwhPerKwp > result.monthlyTotals[0].yieldKwhPerKwp);
});
