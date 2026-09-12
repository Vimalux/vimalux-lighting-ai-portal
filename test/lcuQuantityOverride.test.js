import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { calculateBusinessCase } from "../src/calculations.js";
import { buildProcurementRows } from "../src/procurement.js";

function projectWith100Upgrades() {
  const project = defaultProject();
  project.groups = [{ ...project.groups[0], quantity: 100, upgradeSelected: true }];
  project.solution.smartEnabled = true;
  project.solution.cmsEnabled = true;
  delete project.solution.lcuQuantityOverride;
  return project;
}

test("LCU quantity defaults to upgraded luminaires and an override changes only LCU/CMS quantities", () => {
  const project = projectWith100Upgrades();
  const automatic = calculateBusinessCase(project);
  assert.equal(automatic.lcuQuantity, 100);

  project.solution.lcuQuantityOverride = 80;
  const overridden = calculateBusinessCase(project);
  assert.equal(overridden.lcuQuantity, 80);
  assert.equal(overridden.smartHardwareCapex, automatic.smartHardwareCapex * 0.8);
  assert.equal(overridden.implementationCapex, automatic.implementationCapex * 0.8);
  assert.equal(overridden.cmsRevenue, automatic.cmsRevenue * 0.8);
  assert.equal(overridden.cmsDirectCost, automatic.cmsDirectCost * 0.8);
  assert.equal(overridden.baselineKwh, automatic.baselineKwh);
  assert.equal(overridden.upgradedBaselineKwh, automatic.upgradedBaselineKwh);
  assert.equal(overridden.ledKwh, automatic.ledKwh);

  const lcuRow = buildProcurementRows(project).find((row) => row.source === "LCU");
  assert.equal(lcuRow?.quantity, 80);
});

test("clearing LCU override returns to automatic quantity", () => {
  const project = projectWith100Upgrades();
  project.solution.lcuQuantityOverride = 73;
  assert.equal(calculateBusinessCase(project).lcuQuantity, 73);
  project.solution.lcuQuantityOverride = null;
  assert.equal(calculateBusinessCase(project).lcuQuantity, 100);
  assert.equal(buildProcurementRows(project).find((row) => row.source === "LCU")?.quantity, 100);
});

test("LCU override zero does not change luminaire energy scope", () => {
  const project = projectWith100Upgrades();
  const automatic = calculateBusinessCase(project);
  project.solution.lcuQuantityOverride = 0;
  const result = calculateBusinessCase(project);
  assert.equal(result.lcuQuantity, 0);
  assert.equal(result.smartHardwareCapex, 0);
  assert.equal(result.cmsRevenue, 0);
  assert.equal(result.baselineKwh, automatic.baselineKwh);
  assert.equal(result.upgradedBaselineKwh, automatic.upgradedBaselineKwh);
});
