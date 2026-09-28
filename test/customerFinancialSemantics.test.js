import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { customerAnalysisResult } from "../src/vat.js";

test("cashBreakEvenYear equals first full year with non-negative cumulative customer cash flow", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  const result = calculateBusinessCase(project);
  const expected = result.cashFlowRows.find((row) => Number(row.cumulative) >= 0)?.year ?? null;
  assert.equal(result.cashBreakEvenYear, expected);
});

test("Economic Analysis separates Cash from Finance and LaaS customer semantics", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /const cashDeal = r\.dealType === "cash"/);
  assert.match(source, /const financed = !cashDeal/);
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Rata mensile finanziamento CAPEX/);
  assert.match(source, /Canone mensile LaaS \/ Noleggio tutto incluso/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow cliente positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto/);
  assert.match(source, /indipendenti dalla struttura di finanziamento/);
});

test("Finance and LaaS keep technical payback and ROI secondary, not as customer financing KPIs", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /cashDeal\s*\?\s*\[\[operationalPaybackLabel/);
  assert.match(source, /financed && <Card title=\{technicalMetricsTitle\}>/);
  assert.match(source, /operationalPaybackLabel/);
  assert.match(source, /operationalRoiLabel/);
});

test("Adaptive Dimming customer fee is deal-type independent when configuration is unchanged", () => {
  const values = [];
  for (const dealType of ["cash", "finance", "noleggio_operativo"]) {
    const project = defaultProject({ applyStoredDefaults: false });
    project.solution.powerAidEnabled = true;
    project.assumptions.powerAidCustomerFeePercent = 40;
    project.assumptions.powerAidSupplierSharePercent = 70;
    project.assumptions.dealType = dealType;
    project.assumptions.allInclusiveAnnualPayment = 0;
    const result = customerAnalysisResult(calculateBusinessCase(project));
    assert.ok(result.powerAidGrossSavingEUR > 0, dealType);
    assert.ok(result.powerAidCustomerFee > 0, dealType);
    values.push(result.powerAidCustomerFee);
  }
  assert.ok(Math.abs(values[0] - values[1]) < 1e-9);
  assert.ok(Math.abs(values[0] - values[2]) < 1e-9);
});

test("LaaS keeps Adaptive Dimming fee visible while including it in the all-inclusive payment", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.solution.powerAidEnabled = true;
  project.assumptions.powerAidCustomerFeePercent = 40;
  project.assumptions.powerAidSupplierSharePercent = 70;
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.allInclusiveAnnualPayment = 0;
  const raw = calculateBusinessCase(project);
  const result = customerAnalysisResult(raw);
  const unrecoverableShare = 1 - Number(raw.vatSummary.recoverablePercent || 0) / 100;
  const expected = raw.powerAidCustomerFee * (1 + Number(raw.vatSummary.digitalRate || 0) / 100 * unrecoverableShare);
  assert.ok(raw.powerAidCustomerFee > 0);
  assert.ok(result.powerAidCustomerFee > 0);
  assert.ok(Math.abs(result.powerAidCustomerFee - expected) < 1e-9);
  assert.equal(result.powerAidCustomerFeeIncludedInPayment, true);
  assert.ok(result.allInclusiveAnnualPayment >= result.powerAidCustomerFee);
});

test("zero Adaptive Dimming fee is only the configured zero-fee case, not a LaaS side effect", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.solution.powerAidEnabled = true;
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.powerAidCustomerFeePercent = 0;
  const zeroResult = customerAnalysisResult(calculateBusinessCase(project));
  assert.ok(zeroResult.powerAidGrossSavingEUR > 0);
  assert.equal(zeroResult.powerAidCustomerFee, 0);
  project.assumptions.powerAidCustomerFeePercent = 40;
  assert.ok(customerAnalysisResult(calculateBusinessCase(project)).powerAidCustomerFee > 0);
});

test("PDF Executive Summary uses model-specific semantics and retains technical metrics only as secondary information for financed deals", () => {
  const source = fs.readFileSync(new URL("../src/report.js", import.meta.url), "utf8");
  assert.match(source, /const executiveHead = cashDeal/);
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto - indipendenti dal finanziamento/);
});
