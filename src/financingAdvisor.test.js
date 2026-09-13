import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "./model.js";
import { financingCashflowAdvisor } from "./financingAdvisor.js";

function financedProject() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.financingModel = "laas";
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.contractYears = 10;
  project.assumptions.analysisPeriod = 10;
  project.assumptions.financingPeriod = 5;
  project.assumptions.financingYears = 5;
  project.solution.powerAidEnabled = false;
  return project;
}

test("advisor finds the shortest duration with non-negative annual customer cashflow including OPEX", () => {
  const advisor = financingCashflowAdvisor(financedProject());
  assert.ok(advisor);
  assert.equal(advisor.serviceYears, 10);
  assert.ok(advisor.minimum);
  assert.ok(advisor.minimum.rows.every((row) => row.netCashFlow >= -0.01));
  assert.ok(advisor.minimum.rows.every((row) => row.recurringOpex >= 0));
  const previous = advisor.scenarios.find((scenario) => scenario.financingYears === advisor.minimum.financingYears - 1);
  if (previous) assert.equal(previous.qualifies, false);
});

test("higher recurring customer OPEX cannot produce a shorter cashflow-neutral financing duration", () => {
  const base = financedProject();
  const low = financingCashflowAdvisor(base);
  const highOpex = structuredClone(base);
  const lcu = highOpex.catalogue.smart.find((item) => item.id === highOpex.solution.lcuProductId);
  lcu.annualSalesPrice = Number(lcu.annualSalesPrice || 0) + 30;
  const high = financingCashflowAdvisor(highOpex);
  assert.ok(low?.minimum);
  if (high?.minimum) assert.ok(high.minimum.financingYears >= low.minimum.financingYears);
  else assert.equal(high?.hasCashflowNeutralDuration, false);
});

test("recommended duration respects the configured safety margin when available", () => {
  const advisor = financingCashflowAdvisor(financedProject(), { safetyMarginPercent: 10 });
  assert.ok(advisor?.recommended);
  assert.ok(advisor.recommended.financingYears >= advisor.minimum.financingYears);
  if (advisor.recommended.minMarginPercent >= 10) {
    assert.ok(advisor.recommended.rows.every((row) => row.marginPercent >= 9.999));
  }
});
