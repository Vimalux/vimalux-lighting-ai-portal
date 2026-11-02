import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "./model.js";
import { calculateBusinessCase } from "./calculations.js";
import { createScenarioProject, simulateScenario, optimizeScenarios } from "./scenarioOptimizer.js";

function fixture() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.assumptions.dealType = "finance";
  project.assumptions.financingModel = "finance";
  project.assumptions.financingPeriod = 10;
  project.assumptions.financingYears = 10;
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.contractYears = 10;
  project.assumptions.analysisPeriod = 10;
  project.assumptions.powerAidServicePeriod = 10;
  return project;
}

test("read-only calculation matches normal output without publishing an event", () => {
  const project = fixture();
  const sourceBefore = JSON.stringify(project);
  const oldWindow = globalThis.window;
  let eventCount = 0;
  globalThis.window = { dispatchEvent: () => { eventCount++; }, location: { search: "" } };
  try {
    const isolated = calculateBusinessCase(project, { publish: false });
    assert.equal(eventCount, 0);
    assert.equal(globalThis.window.__VIMALUX_LIVE_BUSINESS_CASE_RESULTS__, undefined);
    const normal = calculateBusinessCase(project);
    assert.equal(eventCount, 1);
    assert.equal(isolated.totalCapex, normal.totalCapex);
    assert.equal(isolated.npv, normal.npv);
    assert.deepEqual(isolated.cashFlowRows, normal.cashFlowRows);
    assert.equal(JSON.stringify(project), sourceBefore);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

test("scenario terms are independently configurable without changing source", () => {
  const project = fixture();
  const original = JSON.stringify(project);
  const scenario = createScenarioProject(project, { financingYears: 10, cmsYears: 15, adaptiveYears: 15 });
  assert.equal(scenario.assumptions.financingYears, 10);
  assert.equal(scenario.assumptions.serviceAgreementPeriod, 15);
  assert.equal(scenario.assumptions.powerAidServicePeriod, 15);
  assert.equal(JSON.stringify(project), original);
  assert.notEqual(scenario, project);
});

test("invalid adaptive coverage or financing bounds fail closed", () => {
  const project = fixture();
  assert.throws(() => createScenarioProject(project, { financingYears: 10, cmsYears: 10, adaptiveYears: 15 }), RangeError);
  assert.throws(() => createScenarioProject(project, { financingYears: 4, cmsYears: 10, adaptiveYears: 10 }), RangeError);
});

test("financing stops at year 10 while 15-year service remains active", () => {
  const scenario = simulateScenario(fixture(), { financingYears: 10, cmsYears: 15, adaptiveYears: 15 }, { minimumMarginPercent: 0 });
  assert.equal(scenario.cashflowRows.length, 15);
  assert.equal(scenario.cashflowRows[10].financePayment, 0);
  assert.equal(scenario.cashflowRows[10].cmsActive, true);
  assert.equal(scenario.cashflowRows[10].adaptiveActive, false); // fixture has Adaptive disabled by default
  assert.ok(Number.isFinite(scenario.comparableNpv));
});

test("optimizer is deterministic and leaves input intact", () => {
  const project = fixture();
  const before = JSON.stringify(project);
  const options = { minFinancingYears: 10, maxYears: 10, cmsMinYears: 10, minimumMarginPercent: 0 };
  const first = optimizeScenarios(project, options);
  const second = optimizeScenarios(project, options);
  assert.equal(first.scenarios.length, 1);
  assert.deepEqual(first.scenarios, second.scenarios);
  assert.equal(JSON.stringify(project), before);
  assert.equal(first.recommendationStatus, "PROVISIONAL_NOT_RISK_ADJUSTED");
});

test("active Adaptive and CMS terms cannot be silently shortened", () => {
  const project = fixture();
  project.solution.smartEnabled = true;
  project.solution.cmsEnabled = true;
  project.solution.powerAidEnabled = true;
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.powerAidServicePeriod = 10;
  assert.throws(() => simulateScenario(project, { financingYears: 5, cmsYears: 12, adaptiveYears: 1 }), /Adaptive term shorter/);
  assert.throws(() => simulateScenario(project, { financingYears: 5, cmsYears: 9, adaptiveYears: 9 }), /CMS term shorter/);
  const out = optimizeScenarios(project, { maxYears: 12, minFinancingYears: 5, minimumMarginPercent: 0 });
  assert.ok(out.scenarios.length > 0);
  assert.ok(out.scenarios.every(s => s.terms.cmsYears >= 10 && s.terms.adaptiveYears >= 10));
});

test("optimizer fails closed when maximum term is shorter than baseline service", () => {
  const project = fixture();
  project.assumptions.serviceAgreementPeriod = 15;
  assert.throws(() => optimizeScenarios(project, { maxYears: 12 }), /maximum shorter/);
});

for (const years of [5, 10, 15]) {
  test(`8% monthly amortization and 6% year-end NPV over 15 years: ${years}/15/15`, () => {
    const p = fixture();
    Object.assign(p.assumptions, { interestRate: 8, discountRate: 6, upfrontPayment: 100,
      interestRateSnapshot: { profileId: 'custom', annualRate: 8 } });
    const before = JSON.stringify(p);
    const s = simulateScenario(p, { financingYears: years, cmsYears: 15, adaptiveYears: 15 });
    const monthlyRate = .08 / 12;
    const annual = (s.totalCapex - 100) * monthlyRate / (1 - (1 + monthlyRate) ** (-years * 12)) * 12;
    for (const row of s.cashflowRows) {
      assert.ok(Math.abs(row.financePayment - (row.year <= years ? annual : 0)) < 1e-7);
      assert.ok(Math.abs(row.discountedCashFlow - row.netCashFlow / 1.06 ** row.year) < 1e-7);
    }
    const expected = -100 + s.cashflowRows.reduce((sum, row) => sum + row.netCashFlow / 1.06 ** row.year, 0);
    assert.ok(Math.abs(s.comparableNpv - expected) < 1e-7);
    assert.equal(s.financingRatePercent, 8);
    assert.equal(s.discountRatePercent, 6);
    assert.equal(JSON.stringify(p), before);
  });
}

test('unclear rates suppress discounted values and NPV ranking, without mutating data', () => {
  for (const changes of [
    { interestRate: undefined }, { discountRate: null }, { discountRate: '' },
    { discountRate: ' ' }, { discountRate: false }, { interestRate: -1 },
    { discountRate: Infinity }, { interestRate: 'invalid' },
    { interestRate: 8 }, // stale default snapshot still says 5
    { interestRateSnapshot: { annualRate: null } },
    { interestRateSnapshot: { annualRate: 5, profileId: 'different' } },
  ]) {
    const p = fixture(); Object.assign(p.assumptions, changes);
    const before = structuredClone(p);
    const out = optimizeScenarios(p, { minFinancingYears: 10, maxYears: 10, cmsMinYears: 10, minimumMarginPercent: 0 });
    assert.equal(out.preliminaryBest, null);
    assert.deepEqual(out.eligible, []);
    const s = out.scenarios[0];
    assert.equal(s.comparableNpv, null);
    assert.ok(s.reasonCodes.includes('UNCLEAR_RATE_BASIS'));
    assert.ok(s.cashflowRows.every(row => row.discountedCashFlow === null));
    assert.deepEqual(p, before);
  }
});

test('explicit zero rates are valid and never replaced with defaults', () => {
  const p = fixture(); Object.assign(p.assumptions, { interestRate: 0, discountRate: 0, interestRateSnapshot: { annualRate: 0 } });
  const s = simulateScenario(p, { financingYears: 5, cmsYears: 15, adaptiveYears: 15 });
  assert.equal(s.rateBasisValid, true);
  assert.equal(s.comparableNpv, s.cumulativeNetCashflow);
  assert.ok(Math.abs(s.cashflowRows[0].financePayment - s.totalCapex / 5) < 1e-7);
});
