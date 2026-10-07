import test from "node:test";
import assert from "node:assert/strict";
import { reconciledProposalCashFlowRows } from "../src/proposalFinalVisualPages.js";

test("cash proposal uses authoritative CAPEX and reconciles Vicopisano cumulative cash flow", () => {
  const rows = reconciledProposalCashFlowRows({
    dealType: "cash",
    totalCapex: 241199,
    vatSummary: { municipalityCapexCash: 241199 },
    cashFlowRows: [
      { year: 1, grossBenefit: 66898, serviceOpex: 10609, payment: 0, netCashFlow: 56289, cumulative: -215438 },
      { year: 2, grossBenefit: 67702, serviceOpex: 10821, payment: 0, netCashFlow: 56881, cumulative: -158556 },
    ],
  });

  assert.equal(rows[0].year, 0);
  assert.equal(rows[0].payment, 241199);
  assert.equal(rows[0].cumulative, -241199);
  assert.equal(rows[1].cumulative, -184910);
  assert.equal(rows[2].cumulative, -128029);
});

test("cash proposal preserves non-recoverable VAT in the authoritative customer cash-out", () => {
  const rows = reconciledProposalCashFlowRows({
    dealType: "cash",
    totalCapex: 100000,
    vatSummary: { municipalityCapexCash: 122000 },
    cashFlowRows: [
      { year: 1, netCashFlow: 30000, cumulative: -92000 },
    ],
  });

  assert.equal(rows[0].payment, 122000);
  assert.equal(rows[0].cumulative, -122000);
  assert.equal(rows[1].cumulative, -92000);
});

test("financed proposal keeps the existing opening-balance semantics", () => {
  const rows = reconciledProposalCashFlowRows({
    dealType: "finance",
    cashFlowRows: [
      { year: 1, netCashFlow: 12000, cumulative: 7000 },
    ],
  });

  assert.equal(rows[0].payment, 5000);
  assert.equal(rows[0].cumulative, -5000);
  assert.equal(rows[1].cumulative, 7000);
});
