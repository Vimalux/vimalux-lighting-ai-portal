import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject, migrateProject } from "../src/model.js";

function smartProject({ cmsYears = 10, powerAidYears = 10, analysisYears = 20 } = {}) {
  const project = defaultProject({ applyStoredDefaults: false });
  project.solution.smartEnabled = true;
  project.solution.cmsEnabled = true;
  project.solution.powerAidEnabled = true;
  project.assumptions.serviceAgreementPeriod = cmsYears;
  project.assumptions.contractYears = cmsYears;
  project.assumptions.powerAidServicePeriod = powerAidYears;
  project.assumptions.analysisPeriod = analysisYears;
  return project;
}

test("CMS and PowerAiD ending after 10 years remove Smart-dependent benefits and OPEX", () => {
  const result = calculateBusinessCase(smartProject());
  const year10 = result.cashFlowRows[9];
  const year11 = result.cashFlowRows[10];

  assert.equal(year10.cmsActive, true);
  assert.equal(year10.powerAidActive, true);
  assert.ok(year10.cloSavingEUR > 0);
  assert.ok(year10.powerAidGrossSavingEUR > 0);
  assert.ok(year10.maintenanceSavingEUR > 0);
  assert.ok(year10.serviceOpex > 0);

  assert.equal(year11.cmsActive, false);
  assert.equal(year11.powerAidActive, false);
  assert.equal(year11.cloSavingEUR, 0);
  assert.equal(year11.powerAidGrossSavingEUR, 0);
  assert.equal(year11.powerAidCustomerFee, 0);
  assert.equal(year11.maintenanceSavingEUR, 0);
  assert.equal(year11.serviceOpex, 0);
  assert.ok(year11.ledEnergySavingEUR > 0);
});

test("CMS 20 years with PowerAiD 10 years keeps CMS benefits and OPEX but ends PowerAiD", () => {
  const result = calculateBusinessCase(smartProject({ cmsYears: 20, powerAidYears: 10 }));
  const year10 = result.cashFlowRows[9];
  const year11 = result.cashFlowRows[10];
  const year20 = result.cashFlowRows[19];

  assert.equal(result.serviceAgreementPeriod, 20);
  assert.equal(result.powerAidServicePeriod, 10);
  assert.equal(year10.cmsActive, true);
  assert.equal(year10.powerAidActive, true);

  assert.equal(year11.cmsActive, true);
  assert.equal(year11.powerAidActive, false);
  assert.ok(year11.cloSavingEUR > 0);
  assert.ok(year11.maintenanceSavingEUR > 0);
  assert.equal(year11.powerAidGrossSavingEUR, 0);
  assert.equal(year11.powerAidCustomerFee, 0);
  assert.ok(year11.serviceOpex > 0);

  assert.equal(year20.cmsActive, true);
  assert.equal(year20.powerAidActive, false);
  assert.ok(year20.serviceOpex > 0);
});

test("PowerAiD cannot outlive CMS", () => {
  const result = calculateBusinessCase(smartProject({ cmsYears: 10, powerAidYears: 20 }));
  assert.equal(result.powerAidServicePeriod, 10);
  assert.equal(result.cashFlowRows[9].powerAidActive, true);
  assert.equal(result.cashFlowRows[10].powerAidActive, false);
});

test("legacy projects default PowerAiD to 10 years and clamp it to CMS duration", () => {
  const cms20 = migrateProject({ assumptions: { serviceAgreementPeriod: 20 }, groups: [] });
  assert.equal(cms20.assumptions.serviceAgreementPeriod, 20);
  assert.equal(cms20.assumptions.powerAidServicePeriod, 10);

  const cms5 = migrateProject({ assumptions: { serviceAgreementPeriod: 5 }, groups: [] });
  assert.equal(cms5.assumptions.serviceAgreementPeriod, 5);
  assert.equal(cms5.assumptions.powerAidServicePeriod, 5);
});

test("PowerAiD contract revenue follows PowerAiD term while CMS fixed service follows CMS term", () => {
  const project = smartProject({ cmsYears: 20, powerAidYears: 10 });
  project.assumptions.opexEscalation = 0;
  project.assumptions.energyEscalation = 0;
  const result = calculateBusinessCase(project);

  assert.ok(Math.abs(result.powerAidContractRevenue - result.powerAidCustomerFee * 10) < 1e-6);
  assert.ok(Math.abs(result.contractOpexRevenue - (result.fixedAnnualOpex * 20 + result.powerAidCustomerFee * 10)) < 1e-6);
});
