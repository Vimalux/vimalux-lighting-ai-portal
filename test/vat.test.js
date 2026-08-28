import test from "node:test";
import assert from "node:assert/strict";
import { calculateVatSummary } from "../src/vat.js";

test("non-deductible municipality VAT adds to CAPEX and OPEX cash-out", () => {
  const project = { assumptions: { vatRecoverability: "non_deductible", vatHardwarePercent: 22, vatDigitalPercent: 22, vatMaintenancePercent: 22, vatStructuralPercent: 10, discountRate: 5 } };
  const result = { totalCapex: 100000, totalAnnualOpex: 1000, grossBenefit: 30000, dealType: "cash", additionalCosts: { rows: [] }, cashFlowRows: [] };
  const vat = calculateVatSummary(project, result);
  assert.equal(vat.capexVat, 22000);
  assert.equal(vat.unrecoverableCapexVat, 22000);
  assert.equal(vat.municipalityCapexCash, 122000);
  assert.equal(vat.annualOpexVat, 220);
  assert.equal(vat.municipalityAnnualOpexCash, 1220);
});

test("qualified civil works use structural rate and partial recovery", () => {
  const project = { assumptions: { vatRecoverability: "partial", vatRecoverablePercent: 50, vatHardwarePercent: 22, vatDigitalPercent: 22, vatMaintenancePercent: 22, vatStructuralPercent: 10, discountRate: 5 } };
  const result = { totalCapex: 100000, totalAnnualOpex: 0, grossBenefit: 0, dealType: "cash", additionalCosts: { rows: [{ costType: "capex", category: "opere_civili", salesTotal: 20000 }] }, cashFlowRows: [] };
  const vat = calculateVatSummary(project, result);
  assert.equal(vat.capexVat, 19600);
  assert.equal(vat.unrecoverableCapexVat, 9800);
  assert.equal(vat.municipalityCapexCash, 109800);
});
