import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { customerAnalysisResult } from "../src/vat.js";

function projectFor(customerType, recoverability) {
  const project = defaultProject({ applyStoredDefaults: false });
  project.customer.customerType = customerType;
  project.assumptions.vatRecoverability = recoverability;
  project.assumptions.vatRecoverablePercent = recoverability === "deductible" ? 100 : 0;
  project.assumptions.vatEnergyPercent = 22;
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.financingPeriod = 10;
  project.assumptions.analysisPeriod = 10;
  return project;
}

test("municipality analysis uses gross customer payment and VAT-aware cash flow", () => {
  const result = calculateBusinessCase(projectFor("municipality", "non_deductible"));
  assert.ok(result.customerGrossMonthlyPayment > result.monthlyPayment);
  assert.equal(result.customerCashFlowRows.length, result.cashFlowRows.length);
  assert.equal(result.customerCashAnnualNetBenefit, result.customerCashFlowRows[0].customerNetCashFlow);
  assert.notEqual(result.customerCashNpv, result.npv);
});

test("fully recoverable ESCO cash flow remains equal to net analysis", () => {
  const result = calculateBusinessCase(projectFor("esco_company", "deductible"));
  assert.equal(result.customerGrossMonthlyPayment, result.monthlyPayment);
  assert.ok(Math.abs(result.customerCashAnnualNetBenefit - result.customerAnnualNetBenefit) < 1e-9);
  assert.ok(Math.abs(result.customerCashNpv - result.npv) < 1e-9);
});

test("economic analysis binds the municipality customer-cash fields", () => {
  const net = calculateBusinessCase(projectFor("municipality", "non_deductible"));
  const analysis = customerAnalysisResult(net);
  assert.equal(analysis.monthlyPayment, net.customerGrossMonthlyPayment);
  assert.equal(analysis.customerAnnualNetBenefit, net.customerCashAnnualNetBenefit);
  assert.equal(analysis.npv, net.customerCashNpv);
  assert.equal(analysis.cashFlowRows[0].netCashFlow, net.customerCashFlowRows[0].customerNetCashFlow);
  assert.ok(analysis.grossBenefit > net.grossBenefit);
});
