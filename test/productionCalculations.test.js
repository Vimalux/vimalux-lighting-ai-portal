import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { crmMetrics, pipelineTotals } from "../src/crm.js";
import { defaultProject } from "../src/model.js";
import { partnerTotals } from "../src/partners.js";

test("recurring revenue categories are independently gated", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  let result = calculateBusinessCase(project);
  assert.ok(result.cmsRevenue > 0);
  assert.ok(result.savingsAsAServiceRevenue > 0);
  project.solution.cmsEnabled = false;
  result = calculateBusinessCase(project);
  assert.equal(result.cmsRevenue, 0);
  assert.ok(result.savingsAsAServiceRevenue > 0);
  project.solution.powerAidEnabled = false;
  result = calculateBusinessCase(project);
  assert.equal(result.savingsAsAServiceRevenue, 0);
  assert.equal(result.powerAidSavingKwh, 0);
});

test("ROI uses annual operational benefit over CAPEX", () => {
  const result = calculateBusinessCase(defaultProject());
  assert.equal(result.roiPercent, (result.grossBenefit - result.totalAnnualOpex) / result.totalCapex * 100);
});

test("CRM weighted TCV never includes duration or recurring revenue", () => {
  const project = defaultProject();
  project.crm = { status: "proposal", closingProbability: 40, totalContractValue: 100000 };
  assert.equal(crmMetrics(project).weightedTcv, 40000);
  project.assumptions.contractYears = 25;
  project.solution.cmsEnabled = true;
  assert.equal(crmMetrics(project).weightedTcv, 40000);
  project.crm.status = "won";
  assert.equal(crmMetrics(project).probability, 100);
  assert.equal(crmMetrics(project).weightedTcv, 100000);
});

test("pipeline keeps recurring totals separate and DATEK only receives CMS", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  const pipeline = pipelineTotals([project]);
  const datek = partnerTotals([project], "DATEK");
  const result = calculateBusinessCase(project);
  assert.equal(pipeline.annualRecurringRevenue, result.annualRecurringRevenue);
  assert.equal(datek.arr, result.cmsRevenue);
  assert.notEqual(datek.arr, result.annualRecurringRevenue);
});
