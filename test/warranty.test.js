import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWarrantyPricing, warrantyLabel } from '../src/warranty.js';

test('customer-facing warranty label shows only the selected term', () => {
  assert.equal(warrantyLabel({ solution: { warrantyYears: 5 } }, 'it'), '5 anni');
  assert.equal(warrantyLabel({ solution: { warrantyYears: 10 } }, 'it'), '10 anni');
  assert.equal(warrantyLabel({ solution: { warrantyYears: 12 } }, 'it'), '12 anni');
  assert.equal(warrantyLabel({ solution: { warrantyYears: 5 } }, 'en'), '5 years');
  assert.equal(warrantyLabel({ solution: { warrantyYears: 10 } }, 'en'), '10 years');
  assert.equal(warrantyLabel({ solution: { warrantyYears: 12 } }, 'en'), '12 years');
});

test('a project-specific 12-year extended warranty keeps the configured uplift', () => {
  const project = {
    solution: { warrantyYears: 12, warrantyUpliftPercentSnapshot: 18.19 },
    catalogue: {
      warranty: { standardYears: 5, extendedYears: 12, upliftPercent: 18.19 },
      led: [{ sku: 'TEST-12', salesPrice: 100 }],
    },
  };
  const priced = applyWarrantyPricing(project);
  assert.equal(priced.catalogue.led[0].warrantyUpliftAppliedPercent, 18.19);
  assert.equal(priced.catalogue.led[0].salesPrice, 118.19);
  assert.equal(warrantyLabel(project, 'it'), '12 anni');
});

test('extended warranty uplift remains internal to pricing', () => {
  const project = {
    solution: { warrantyYears: 10, warrantyUpliftPercentSnapshot: 18.19 },
    catalogue: {
      warranty: { standardYears: 5, extendedYears: 10, upliftPercent: 18.19 },
      led: [{ sku: 'TEST', salesPrice: 100 }],
    },
  };
  const priced = applyWarrantyPricing(project);
  assert.equal(priced.catalogue.led[0].baseSalesPrice, 100);
  assert.equal(priced.catalogue.led[0].warrantyUpliftAppliedPercent, 18.19);
  assert.equal(priced.catalogue.led[0].salesPrice, 118.19);
  assert.equal(warrantyLabel(project, 'it'), '10 anni');
});

test('an editable warranty term above the standard term uses the saved uplift', () => {
  const project = {
    solution: { warrantyYears: 12, warrantyUpliftPercentSnapshot: 18.19 },
    catalogue: {
      warranty: { standardYears: 5, extendedYears: 10, upliftPercent: 18.19 },
      led: [{ sku: 'CUSTOM-12', salesPrice: 100 }],
    },
  };
  const priced = applyWarrantyPricing(project);
  assert.equal(priced.catalogue.led[0].salesPrice, 118.19);
  assert.equal(warrantyLabel(project, 'it'), '12 anni');
});
