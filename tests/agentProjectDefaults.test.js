import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject } from '../src/model.js';

test('new Business Cases use the current VIMALUX energy-price default', () => {
  const project = defaultProject();
  assert.equal(project.assumptions.energyPrice, 0.29);
  assert.equal(project.assumptions.operatingHours, 4200);
});
