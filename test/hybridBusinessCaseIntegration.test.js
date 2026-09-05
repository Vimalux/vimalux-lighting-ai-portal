import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { calculateBusinessCase } from "../src/calculations.js";
import { calculateBusinessCase as calculateBaseBusinessCase } from "../src/calculationsBase.js";

function normalProject() {
  const p = defaultProject();
  p.assumptions.operatingHours = 4200;
  p.assumptions.energyPrice = 0.29;
  p.groups = [{ id: "g1", quantity: 10, technology: "SAP", existingWattage: 100, proposedProductId: "led-normal", projectLedWattage: 40, upgradeSelected: true }];
  p.catalogue.led = [{ id: "led-normal", name: "Normal LED", wattage: 40, lumen: 6400, costPrice: 50, salesPrice: 100, active: true }];
  return p;
}

function hybridProject() {
  const p = normalProject();
  p.catalogue.led = [{ id: "led-hybrid", name: "Hybrid", wattage: 40, lumen: 6200, costPrice: 100, salesPrice: 200, active: true, hybrid: true, pvWp: 45, batteryWh: 230, usableBatteryWh: 207, solarModeW: 40, batteryRoundtripEfficiencyPercent: 90, mppt: true }];
  p.groups[0].proposedProductId = "led-hybrid";
  p.assumptions.hybridSolarYieldKwhPerKwp = 1500;
  return p;
}

test("non-hybrid projects retain the baseline calculation exactly", () => {
  const p = normalProject();
  const base = calculateBaseBusinessCase(p);
  const result = calculateBusinessCase(p);
  for (const key of ["finalKwh", "energySaving", "grossBenefit", "payback", "roiPercent", "npv", "customerAnnualNetBenefit"]) {
    assert.equal(result[key], base[key], key);
  }
  assert.equal(result.hybridSolarSavingKwh, 0);
  assert.equal(result.hybridSolarSavingEUR, 0);
});

test("hybrid solar reduces grid use and increases customer benefit", () => {
  const p = hybridProject();
  const base = calculateBaseBusinessCase(p);
  const result = calculateBusinessCase(p);
  assert.ok(result.hybridSolarSavingKwh > 0);
  assert.ok(result.hybridSolarSavingEUR > 0);
  assert.ok(result.finalKwh < base.finalKwh);
  assert.ok(result.energySaving > base.energySaving);
  assert.ok(result.grossBenefit > base.grossBenefit);
  assert.ok(result.customerAnnualNetBenefit > base.customerAnnualNetBenefit);
  assert.ok(result.energyReductionPercent > base.energyReductionPercent);
});
