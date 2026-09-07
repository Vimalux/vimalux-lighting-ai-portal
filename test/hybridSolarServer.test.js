import test from "node:test";
import assert from "node:assert/strict";
import { parsePvgisPvcalcMonthly, resolveMunicipalitySolar } from "../src/solarLocation.js";
import { calculateHybridSolar } from "../src/hybridSolar.js";

test("PVGIS PVcalc monthly output is interpreted as kWh per 1 kWp", () => {
  const fixed = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, E_m: 100 + index }));
  const monthly = parsePvgisPvcalcMonthly({ outputs: { monthly: { fixed } } });
  assert.equal(monthly.length, 12);
  assert.equal(monthly[0], 100);
  assert.equal(monthly[11], 111);
  assert.equal(monthly.reduce((sum, value) => sum + value, 0), 1266);
});

test("browser/server resolver accepts same-origin hybrid solar response", async () => {
  const payload = {
    query: "Poggiardo",
    resolvedName: "Poggiardo",
    latitude: 40.05,
    longitude: 18.38,
    monthlyYieldKwhPerKwp: Array(12).fill(120),
    annualYieldKwhPerKwp: 1440,
    dataLevel: "municipality",
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => payload };
  };
  const result = await resolveMunicipalitySolar("Poggiardo", { fetchImpl, preferServer: true });
  assert.match(calls[0], /^\/api\/hybrid-solar\?/);
  assert.match(calls[0], /municipality=Poggiardo/);
  assert.equal(result.annualYieldKwhPerKwp, 1440);
});

test("hybrid product with municipality solar profile generates usable solar and euro benefit", () => {
  const project = {
    catalogue: {
      led: [{
        id: "ENBY-40",
        model: "ENBY-40",
        hybrid: true,
        pvWp: 45,
        batteryWh: 230,
        usableBatteryWh: 207,
        solarModeW: 40,
        batteryRoundtripEfficiencyPercent: 90,
        wattage: 40,
      }],
    },
    groups: [{ id: "g1", name: "Hybrid", quantity: 24, upgradeSelected: true, proposedProductId: "ENBY-40", projectLedWattage: 40 }],
    assumptions: {
      operatingHours: 4200,
      energyPrice: 0.29,
      hybridSolarLocation: {
        latitude: 40.05,
        monthlyYieldKwhPerKwp: Array(12).fill(120),
        dataLevel: "municipality",
      },
    },
  };
  const result = calculateHybridSolar(project);
  assert.equal(result.enabled, true);
  assert.equal(result.totalHybridUnits, 24);
  assert.ok(result.totalPvKwh > 0);
  assert.ok(result.totalUsableSolarKwh > 0);
  assert.ok(result.totalGridSavingEur > 0);
  assert.ok(result.totalContributionPercent > 0);
});
