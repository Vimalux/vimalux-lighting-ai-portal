import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { buildBusinessCaseSnapshot } from "../src/businessCaseSync.js";

test("shared KPI dictionary separates existing, upgrade and smart-connected luminaires", () => {
  const project = defaultProject();
  project.groups = [
    { ...project.groups[0], id: "g1", quantity: 100, upgradeSelected: true, smartAssigned: true },
    { ...project.groups[0], id: "g2", quantity: 20, upgradeSelected: false, smartAssigned: false },
  ];
  project.solution.smartEnabled = true;
  project.solution.cmsEnabled = true;
  project.assumptions.energyPrice = 0.29;
  project.assumptions.serviceAgreementPeriod = 10;

  const snapshot = buildBusinessCaseSnapshot(project, "2026-08-21T12:00:00.000Z");

  assert.equal(snapshot.existingLuminaires, 120);
  assert.equal(snapshot.upgradeLuminaires, 100);
  assert.equal(snapshot.smartConnectedLuminaires, 100);
  assert.equal(snapshot.smartNodeCount, 100);
  assert.equal(snapshot.upgradeCoveragePct, 100 / 120 * 100);
  assert.equal(snapshot.contractYears, 10);
  assert.ok(snapshot.annualEnergyCostBefore >= snapshot.annualEnergyCostAfter);
  assert.ok(snapshot.annualEnergySavingEUR >= 0);
  assert.equal(snapshot.tcv >= 0, true);
});
