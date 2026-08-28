import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_ASSUMPTIONS,
  DEFAULT_ASSUMPTIONS_STORAGE_KEY,
  defaultProject,
  migrateProject,
  readStoredDefaultAssumptions,
} from "./model.js";

function mockStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  global.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test("admin defaults are applied to newly created Business Cases", () => {
  mockStorage({
    [DEFAULT_ASSUMPTIONS_STORAGE_KEY]: JSON.stringify({
      version: 1,
      values: { operatingHours: 4100, energyPrice: 0.27, freightCostPerLamp: 11 },
    }),
  });
  const project = defaultProject();
  assert.equal(project.assumptions.operatingHours, 4100);
  assert.equal(project.assumptions.energyPrice, 0.27);
  assert.equal(project.assumptions.freightCostPerLamp, 11);
  assert.equal(project.assumptions.powerAidPercent, BASE_ASSUMPTIONS.powerAidPercent);
});

test("existing Business Cases keep their stored assumptions when defaults change", () => {
  mockStorage({
    [DEFAULT_ASSUMPTIONS_STORAGE_KEY]: JSON.stringify({ values: { energyPrice: 0.21, operatingHours: 3900 } }),
  });
  const existing = defaultProject({ applyStoredDefaults: false });
  existing.assumptions.energyPrice = 0.31;
  existing.assumptions.operatingHours = 4300;
  const migrated = migrateProject(existing);
  assert.equal(migrated.assumptions.energyPrice, 0.31);
  assert.equal(migrated.assumptions.operatingHours, 4300);
});

test("invalid stored values fail safely to the platform baseline", () => {
  mockStorage({
    [DEFAULT_ASSUMPTIONS_STORAGE_KEY]: JSON.stringify({ values: { energyPrice: "bad", operatingHours: null, unknownField: 999 } }),
  });
  const defaults = readStoredDefaultAssumptions();
  assert.equal(defaults.energyPrice, BASE_ASSUMPTIONS.energyPrice);
  assert.equal(defaults.operatingHours, 0);
  assert.equal(defaults.unknownField, undefined);
});
