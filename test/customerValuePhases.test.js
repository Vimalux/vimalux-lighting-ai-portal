import test from "node:test";
import assert from "node:assert/strict";
import { buildYearOneCustomerValuePhases } from "../src/customerValuePhases.js";

function fixture() {
  const current = 15538;
  const rows = Array.from({ length: 20 }, (_, index) => {
    const year = index + 1;
    const smart = year <= 13;
    const growth = Math.pow(1.02, index);
    return {
      year,
      cmsActive: smart,
      powerAidActive: smart,
      currentOperatingCost: current * growth,
      futureOperatingCost: smart ? 4084 * growth : 13297 * growth,
      servicePayment: smart ? 1461 * growth : 0,
      investmentPayment: 0,
      customerSaving: smart ? 8745 * growth : 2241 * growth,
    };
  });
  return {
    analysisPeriod: 20,
    serviceAgreementPeriod: 13,
    dealType: "cash",
    fixedAnnualOpex: 255,
    maintenanceSaving: 3240,
    hybridSolarSavingEUR: 1248,
    cashFlowRows: [{
      ledEnergySavingEUR: 2621,
      hybridSolarSavingEUR: 1248,
      cloSavingEUR: 1330,
      powerAidGrossSavingEUR: 3015,
      powerAidCustomerFee: 1206,
    }],
    customerValueRows: rows,
  };
}

test("report phases always reconcile to the year-one current-cost baseline", () => {
  const calculated = fixture();
  const { phases, first } = buildYearOneCustomerValuePhases(calculated);
  assert.equal(phases.length, 2);
  for (const phase of phases) {
    const display = phase.display;
    const total = display.futureOperatingCost + display.servicePayment + display.investmentPayment + display.customerSaving;
    assert.ok(Math.abs(total - first.currentOperatingCost) < 0.001);
    assert.equal(display.currentOperatingCost, first.currentOperatingCost);
  }
});

test("Hybrid Solar remains in the post-service physical saving", () => {
  const calculated = fixture();
  const { phases } = buildYearOneCustomerValuePhases(calculated);
  const smart = phases[0].display;
  const post = phases[1].display;
  assert.equal(smart.hybridSolarSaving, 1248);
  assert.equal(post.hybridSolarSaving, 1248);
  assert.equal(post.customerSaving, 2621 + 1248);
  assert.equal(smart.customerSaving, 2621 + 1248 + 1330 + 3240 + 3015 - 255 - 1206);
});

test("later-year escalation does not make a report bar exceed the year-one baseline", () => {
  const calculated = fixture();
  calculated.customerValueRows[13].currentOperatingCost = 25000;
  calculated.customerValueRows[13].futureOperatingCost = 22000;
  const { phases, first } = buildYearOneCustomerValuePhases(calculated);
  const post = phases[1].display;
  assert.equal(post.currentOperatingCost, first.currentOperatingCost);
  assert.ok(post.reconciledTotal <= first.currentOperatingCost + 0.001);
});
