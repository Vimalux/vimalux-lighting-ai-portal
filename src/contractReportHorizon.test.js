import test from "node:test";
import assert from "node:assert/strict";
import { contractReportResult } from "./contractReportHorizon.js";

test("customer report horizon follows service term without mutating calculation result", () => {
  const calculated = {
    serviceAgreementPeriod: 10,
    analysisPeriod: 20,
    customerValueRows: Array.from({ length: 20 }, (_, i) => ({ year: i + 1 })),
    cashFlowRows: Array.from({ length: 20 }, (_, i) => ({ year: i + 1 })),
  };
  const display = contractReportResult(calculated);
  assert.equal(display.analysisPeriod, 10);
  assert.equal(display.customerValueRows.length, 10);
  assert.equal(display.cashFlowRows.length, 10);
  assert.equal(calculated.analysisPeriod, 20);
  assert.equal(calculated.customerValueRows.length, 20);
  assert.equal(calculated.cashFlowRows.length, 20);
});

test("five-year financing remains visible inside a ten-year service report", () => {
  const calculated = {
    financingPeriod: 5,
    serviceAgreementPeriod: 10,
    analysisPeriod: 20,
    customerValueRows: Array.from({ length: 20 }, (_, i) => ({ year: i + 1, investmentPayment: i < 5 ? 100 : 0 })),
    cashFlowRows: Array.from({ length: 20 }, (_, i) => ({ year: i + 1 })),
  };
  const display = contractReportResult(calculated);
  assert.equal(display.financingPeriod, 5);
  assert.equal(display.customerValueRows[4].investmentPayment, 100);
  assert.equal(display.customerValueRows[5].investmentPayment, 0);
  assert.equal(display.customerValueRows.at(-1).year, 10);
});
