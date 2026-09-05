import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { calculateHybridSolar, hybridWeightStatus } from "../src/hybridSolar.js";

test("hybrid metadata does not change the existing LED Business Case engine", () => {
  const base = defaultProject({ applyStoredDefaults: false });
  const before = calculateBusinessCase(base);
  const selectedId = base.groups[0].proposedProductId;
  const product = base.catalogue.led.find((item) => item.id === selectedId);
  product.hybrid = true;
  product.pvWp = 45;
  product.batteryWh = 230;
  product.solarModeW = 40;
  product.weightKg = 12;
  base.assumptions.hybridSolarYieldKwhPerKwp = 1400;
  const after = calculateBusinessCase(base);

  for (const key of ["totalCapex", "finalKwh", "energySaving", "totalDirectCosts", "netProjectProfit", "netProjectMarginPercent"]) {
    assert.equal(after[key], before[key], `${key} must remain unchanged until hybrid savings are explicitly integrated`);
  }
});

test("hybrid preview calculates PV production and usable solar separately", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  const selectedId = project.groups[0].proposedProductId;
  const product = project.catalogue.led.find((item) => item.id === selectedId);
  product.hybrid = true;
  product.pvWp = 45;
  product.batteryWh = 230;
  product.usableBatteryWh = 205;
  product.solarModeW = 40;
  product.weightKg = 12;
  product.batteryRoundtripEfficiencyPercent = 90;
  project.assumptions.hybridSolarYieldKwhPerKwp = 1400;

  const result = calculateHybridSolar(project);
  assert.equal(result.enabled, true);
  assert.equal(result.totalHybridUnits, 100);
  assert.equal(result.totalPvKwh, 6300);
  assert.equal(result.totalUsableSolarKwh, 5670);
  assert.equal(result.rows[0].batteryAutonomyHours, 5.125);
  assert.equal(result.hasWeightFailure, false);
});

test("battery capacity constrains usable annual solar energy", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  const selectedId = project.groups[0].proposedProductId;
  const product = project.catalogue.led.find((item) => item.id === selectedId);
  product.hybrid = true;
  product.pvWp = 100;
  product.batteryWh = 50;
  product.usableBatteryWh = 50;
  product.solarModeW = 20;
  product.batteryRoundtripEfficiencyPercent = 100;
  project.assumptions.hybridSolarYieldKwhPerKwp = 2000;

  const result = calculateHybridSolar(project);
  assert.equal(result.totalUsableSolarKwh, 1825);
});

test("18 kg is a warning boundary and above 18 kg fails", () => {
  assert.equal(hybridWeightStatus(17.9), "ok");
  assert.equal(hybridWeightStatus(18), "warning");
  assert.equal(hybridWeightStatus(18.1), "fail");
});
