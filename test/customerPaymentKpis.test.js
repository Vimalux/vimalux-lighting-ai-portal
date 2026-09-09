import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const reportSource = fs.readFileSync(new URL("../src/report.js", import.meta.url), "utf8");

test("customer payment presentation distinguishes LaaS from CAPEX financing", () => {
  assert.match(appSource, /Canone mensile LaaS \/ Noleggio tutto incluso/);
  assert.match(appSource, /OPEX servizi \/ mese \(incluso nel canone\)/);
  assert.match(appSource, /Rata mensile finanziamento CAPEX/);
  assert.match(appSource, /Pagamento mensile totale cliente/);
});

test("operational ROI and payback are explicitly labelled as financing-independent", () => {
  assert.match(appSource, /Payback operativo \(escl\. finanziamento\)/);
  assert.match(appSource, /ROI operativo \(escl\. finanziamento\)/);
  assert.match(reportSource, /Operational payback \(excl\. financing\)/);
});

test("interest rate changes financed customer payment and NPV but not operational ROI/payback", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.assumptions.dealType = "noleggio_operativo";
  project.assumptions.financingPeriod = 10;
  project.assumptions.financingYears = 10;
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.contractYears = 10;
  project.assumptions.analysisPeriod = 20;
  project.assumptions.allInclusiveAnnualPayment = 0;
  project.assumptions.interestRate = 7;
  const at7 = calculateBusinessCase(project);
  project.assumptions.interestRate = 8;
  const at8 = calculateBusinessCase(project);
  assert.ok(at8.financingMonthlyPayment > at7.financingMonthlyPayment);
  assert.ok(at8.monthlyPayment > at7.monthlyPayment);
  assert.ok(at8.npv < at7.npv);
  assert.equal(at8.payback, at7.payback);
  assert.equal(at8.roiPercent, at7.roiPercent);
});
