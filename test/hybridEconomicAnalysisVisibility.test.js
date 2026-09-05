import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { hybridEconomicDisplay, resolveActiveProject } from "../src/hybridEconomicAnalysisRuntime.js";

test("hybrid economic display exposes the Business Case hybrid saving", () => {
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

  const display = hybridEconomicDisplay(project);
  assert.ok(display);
  assert.equal(display.units, 100);
  assert.ok(display.savingKwh > 0);
  assert.ok(display.savingEur > 0);
});

test("non-hybrid projects do not get hybrid economic UI", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  assert.equal(hybridEconomicDisplay(project), null);
});

test("active Business Case is resolved from the stable URL identity", () => {
  const first = defaultProject({ applyStoredDefaults: false });
  const second = defaultProject({ applyStoredDefaults: false });
  first.id = "bc-first";
  second.id = "bc-second";
  const resolved = resolveActiveProject([first, second], "?business_case_id=bc-second");
  assert.equal(resolved.id, "bc-second");
});
