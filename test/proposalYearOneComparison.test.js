import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { buildYearOneScenario } from "../src/proposalVisualPagesSimple.js";

test("post-service proposal comparison uses year-one prices, not year-11 escalated euros", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.powerAidServicePeriod = 10;
  project.assumptions.analysisPeriod = 20;
  project.assumptions.energyEscalation = 2;
  const calculated = calculateBusinessCase(project);
  const postServicePhase = { row: calculated.customerValueRows[10] };
  const display = buildYearOneScenario(calculated, postServicePhase);
  const yearOneLedSaving = calculated.cashFlowRows[0].ledEnergySavingEUR;

  assert.equal(display.cmsActive, false);
  assert.equal(display.powerAidActive, false);
  assert.equal(display.servicePayment, 0);
  assert.ok(Math.abs(display.customerSaving - yearOneLedSaving) < 1e-9);
  assert.ok(Math.abs(display.futureOperatingCost - (calculated.customerValueRows[0].currentOperatingCost - yearOneLedSaving)) < 1e-9);
  assert.notEqual(Math.round(display.customerSaving), Math.round(calculated.customerValueRows[10].customerSaving));
});

test("active Smart phase keeps year-one CMS, CLO, maintenance and PowerAiD values", () => {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  const calculated = calculateBusinessCase(project);
  const phase = { row: calculated.customerValueRows[0] };
  const display = buildYearOneScenario(calculated, phase);

  assert.ok(Math.abs(display.futureOperatingCost - calculated.customerValueRows[0].futureOperatingCost) < 1e-9);
  assert.ok(Math.abs(display.servicePayment - calculated.customerValueRows[0].servicePayment) < 1e-9);
  assert.ok(Math.abs(display.customerSaving - calculated.customerValueRows[0].customerSaving) < 1e-9);
});