import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { calculateBusinessCase } from "../src/calculations.js";
import { pipelineStageTotals, pipelineTotals, formatProbabilityPoints } from "../src/crm.js";
import { partnerTotals } from "../src/partners.js";
import { syncBusinessCaseResult } from "../src/businessCaseSync.js";

const projectsFor = (status) => {
  const first = defaultProject();
  first.id = "first";
  first.crm.status = status;
  first.crm.totalContractValue = 100000;
  first.crm.closingProbability = 25;
  const second = defaultProject();
  second.id = "second";
  second.crm.status = status;
  second.crm.totalContractValue = 200000;
  second.crm.closingProbability = 75;
  return [first, second].map(syncBusinessCaseResult);
};

test("pipeline totals preserve recurring revenue independently from CRM TCV", () => {
  const projects = projectsFor("proposal");
  const totals = pipelineTotals(projects);
  assert.equal(totals.totalContractValue, 300000);
  assert.equal(totals.weightedTcv, 175000);
  const expectedArr = projects.reduce((sum, project) => sum + calculateBusinessCase(project).annualRecurringRevenue, 0);
  assert.equal(totals.annualRecurringRevenue, expectedArr);
});

test("pipeline stage probability is expressed in percentage points", () => {
  const projects = projectsFor("proposal");
  const proposal = pipelineStageTotals(projects).find(row => row.stage === "proposal");
  assert.equal(proposal.averageProbability, 50);
  assert.equal(formatProbabilityPoints(proposal.averageProbability), "50%");
});

test("won probability remains 100 percent", () => {
  const projects = projectsFor("proposal");
  projects.forEach(project => { project.crm.status = "won"; });
  const won = pipelineStageTotals(projects).find(row => row.stage === "won");
  assert.equal(won.averageProbability, 100);
  assert.equal(formatProbabilityPoints(won.averageProbability), "100%");
});

test("pipeline keeps recurring totals separate and selected CMS partner only receives CMS", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  const selectedLcu = project.catalogue.smart.find(item => item.id === project.solution.lcuProductId);
  selectedLcu.brand = "DATEK";
  const synced = syncBusinessCaseResult(project);
  const pipeline = pipelineTotals([synced]);
  const datek = partnerTotals([synced], "DATEK");
  const result = calculateBusinessCase(project);
  assert.equal(pipeline.annualRecurringRevenue, result.annualRecurringRevenue);
  assert.equal(datek.arr, result.cmsRevenue);
  assert.notEqual(datek.arr, result.annualRecurringRevenue);
});

test("Adaptive Dimming partner value uses supplier share and only includes enabled partner projects", () => {
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
  assert.equal(portfolio.projects, 1);
  assert.equal(portfolio.arr, projectOnly.arr);
});