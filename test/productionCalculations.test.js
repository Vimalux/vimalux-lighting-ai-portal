import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { calculateWeightedTcv, crmMetrics, formatProbabilityPoints, pipelineStageTotals, pipelineTotals, probabilityFactor } from "../src/crm.js";
import { defaultProject } from "../src/model.js";
import { partnerTotals } from "../src/partners.js";
import { syncBusinessCaseResult } from "../src/businessCaseSync.js";

test("PowerAiD recurring revenue requires an active CMS connection", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  let result = calculateBusinessCase(project);
  assert.ok(result.cmsRevenue > 0);
  assert.ok(result.savingsAsAServiceRevenue > 0);
  project.solution.cmsEnabled = false;
  result = calculateBusinessCase(project);
  assert.equal(result.cmsRevenue, 0);
  assert.equal(result.savingsAsAServiceRevenue, 0);
  assert.equal(result.powerAidSavingKwh, 0);
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

test("probability points normalize once and weighted TCV matches production examples", () => {
  assert.equal(probabilityFactor(50), 0.5);
  assert.equal(calculateWeightedTcv(46636, 100), 46636);
  assert.equal(calculateWeightedTcv(1500000, 50), 750000);
  assert.equal(Math.round(calculateWeightedTcv(1083487, 40)), 433395);
  assert.equal(calculateWeightedTcv(3000000, 80), 2400000);
  assert.equal(formatProbabilityPoints(50), "50%");
  assert.equal(formatProbabilityPoints(80), "80%");
  assert.equal(formatProbabilityPoints(100), "100%");
});

test("stage averages use stored percentage points without multiplying display by 100", () => {
  const probabilities = [40, 50, 45, 55];
  const projectsFor = status => probabilities.map((closingProbability) => {
    const project = defaultProject();
    project.crm = { status, closingProbability, totalContractValue: 100 };
    return project;
  });
  for (const stage of ["proposal", "negotiation", "closing"]) {
    const summary = pipelineStageTotals(projectsFor(stage)).find(row => row.stage === stage);
    assert.equal(summary.averageProbability, 47.5);
    assert.equal(formatProbabilityPoints(summary.averageProbability), "47.5%");
  }
  const projects = projectsFor("proposal");
  projects.forEach(project => { project.crm.status = "won"; });
  const won = pipelineStageTotals(projects).find(row => row.stage === "won");
  assert.equal(won.averageProbability, 100);
  assert.equal(formatProbabilityPoints(won.averageProbability), "100%");
});

test("pipeline keeps recurring totals separate and DATEK only receives CMS", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  const synced = syncBusinessCaseResult(project);
  const pipeline = pipelineTotals([synced]);
  const datek = partnerTotals([synced], "DATEK");
  const result = calculateBusinessCase(project);
  assert.equal(pipeline.annualRecurringRevenue, result.annualRecurringRevenue);
  assert.equal(datek.arr, result.cmsRevenue);
  assert.notEqual(datek.arr, result.annualRecurringRevenue);
});

test("Felicity partner value uses supplier share and supports project-level filtering", () => {
  const first = defaultProject();
  first.id = "first";
  first.solution.powerAidEnabled = true;
  first.assumptions.powerAidCustomerFeePercent = 50;
  first.assumptions.powerAidSupplierSharePercent = 70;
  const second = defaultProject();
  second.id = "second";
  second.solution.powerAidEnabled = false;
  const result = calculateBusinessCase(first);
  const projectOnly = partnerTotals([first], "FELICITY");
  const portfolio = partnerTotals([first, second], "FELICITY");
  assert.equal(projectOnly.projects, 1);
  assert.equal(projectOnly.arr, result.powerAidSupplierCost);
  assert.equal(projectOnly.totalContractValue, result.powerAidSupplierContractCost);
  assert.equal(portfolio.projects, 2);
  assert.equal(portfolio.arr, projectOnly.arr);
});
