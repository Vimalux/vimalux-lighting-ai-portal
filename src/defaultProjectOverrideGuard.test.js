import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ASSUMPTIONS_STORAGE_KEY,
  sanitizeStoredDefaultOverrides,
} from "./defaultProjectOverrideGuard.js";

function storageWith(payload) {
  const values = new Map([[DEFAULT_ASSUMPTIONS_STORAGE_KEY, JSON.stringify(payload)]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    read: () => JSON.parse(values.get(DEFAULT_ASSUMPTIONS_STORAGE_KEY)),
  };
}

test("project-specific commercial overrides are removed from nested stored defaults", () => {
  const storage = storageWith({
    version: 1,
    values: {
      energyPrice: 0.29,
      financingPeriod: 10,
      allInclusiveAnnualPayment: 75000,
      officialOfferCapex: 123456,
      officialAnnualOpex: 9876,
    },
  });
  assert.equal(sanitizeStoredDefaultOverrides(storage), true);
  const saved = storage.read();
  assert.equal(saved.values.energyPrice, 0.29);
  assert.equal(saved.values.financingPeriod, 10);
  assert.equal(saved.values.allInclusiveAnnualPayment, undefined);
  assert.equal(saved.values.officialOfferCapex, undefined);
  assert.equal(saved.values.officialAnnualOpex, undefined);
});

test("legacy flat default storage is sanitized without deleting legitimate defaults", () => {
  const storage = storageWith({
    operatingHours: 4200,
    allInclusiveAnnualPayment: 50000,
    minimumMarginPercent: 30,
  });
  assert.equal(sanitizeStoredDefaultOverrides(storage), true);
  const saved = storage.read();
  assert.deepEqual(saved, { operatingHours: 4200, minimumMarginPercent: 30 });
});

test("clean stored defaults remain byte-stable in behavior", () => {
  const storage = storageWith({ values: { energyPrice: 0.31, operatingHours: 4300 } });
  assert.equal(sanitizeStoredDefaultOverrides(storage), false);
  assert.deepEqual(storage.read(), { values: { energyPrice: 0.31, operatingHours: 4300 } });
});
