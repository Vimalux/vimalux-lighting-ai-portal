import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "./model.js";
import { financingCashflowAdvisor } from "./financingAdvisor.js";

function baseProject() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.contractYears = 10;
  project.assumptions.analysisPeriod = 10;
  project.assumptions.financingPeriod = 5;
  project.assumptions.financingYears = 5;
  project.solution.powerAidEnabled = false;
  return project;
}

function financeProject() {
  const project = baseProject();
  project.assumptions.dealType = "finance";
  project.assumptions.financingModel = "finance";
  return project;
}

function noleggioProject() {
  const project = baseProject();
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.financingModel = "laas";
  return project;
}

test("finance advisor finds shortest duration with non-negative cashflow including recurring OPEX", () => {
  const advisor = financingCashflowAdvisor(financeProject());
  assert.equal(advisor.mode, "finance");
  assert.equal(advisor.serviceYears, 10);
  assert.ok(advisor.minimum);
  assert.ok(advisor.minimum.rows.every((row) => row.netCashFlow >= -0.01));
  assert.ok(advisor.minimum.rows.some((row) => row.recurringOpex >= 0));
});

test("Noleggio advisor uses one all-inclusive payment and does not deduct OPEX twice", () => {
  const advisor = financingCashflowAdvisor(noleggioProject(), { maximumYears: 12 });
  assert.equal(advisor.mode, "noleggio_operativo");
  assert.ok(advisor.minimum);
  const row = advisor.minimum.rows[0];
  assert.equal(row.recurringOpex, 0);
  assert.ok(row.includedOpex >= 0);
  assert.ok(row.allInclusivePayment > 0);
  assert.ok(Math.abs(row.netCashFlow - (row.grossBenefit - row.allInclusivePayment)) < 0.01);
});

test("Noleggio scenario duration is also the contract/service duration", () => {
  const advisor = financingCashflowAdvisor(noleggioProject(), { maximumYears: 12 });
  assert.ok(advisor.minimum);
  assert.equal(advisor.minimum.contractYears, advisor.minimum.durationYears);
  assert.equal(advisor.minimum.rows.length, advisor.minimum.durationYears);
});

test("higher Noleggio service OPEX cannot improve minimum duration", () => {
  const base = noleggioProject();
  const low = financingCashflowAdvisor(base, { maximumYears: 15 });
  const highOpex = structuredClone(base);
  const lcu = highOpex.catalogue.smart.find((item) => item.id === highOpex.solution.lcuProductId);
  lcu.annualSalesPrice = Number(lcu.annualSalesPrice || 0) + 30;
  const high = financingCashflowAdvisor(highOpex, { maximumYears: 15 });
  assert.ok(low?.minimum);
  if (high?.minimum) assert.ok(high.minimum.durationYears >= low.minimum.durationYears);
  else assert.equal(high?.hasCashflowNeutralDuration, false);
});

test("recommended duration respects safety margin when available", () => {
  const advisor = financingCashflowAdvisor(noleggioProject(), { safetyMarginPercent: 10, maximumYears: 15 });
  assert.ok(advisor?.recommended);
  assert.ok(advisor.recommended.durationYears >= advisor.minimum.durationYears);
  if (advisor.recommended.minMarginPercent >= 10) {
    assert.ok(advisor.recommended.rows.every((row) => row.marginPercent >= 9.999));
  }
});
