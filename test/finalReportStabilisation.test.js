import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  alignedTable,
  buildCustomerCapexRows,
  needsNewPdfPage,
  pdfSafeText,
  reportMoney,
} from "../src/reportPresentation.js";
import { buildCostEvolutionPhases, phaseFromCustomerValueRow } from "../src/proposalVisualPages.js";

const preliminarySource = readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");
const visualSource = readFileSync(new URL("../src/proposalVisualPages.js", import.meta.url), "utf8");

test("Italian money formatting remains grouped and PDF-safe", () => {
  assert.equal(reportMoney(1010, "it"), "1.010 €");
  assert.equal(reportMoney(131308, "it"), "131.308 €");
  assert.equal(pdfSafeText("A → B · CO₂ × 2"), "A - B | CO2 x 2");
});

test("table header alignment follows the corresponding value alignment", () => {
  const hook = alignedTable({ 0: "left", 1: "right" }).didParseCell;
  const textHeader = { column: { index: 0 }, cell: { styles: {} } };
  const moneyHeader = { column: { index: 1 }, cell: { styles: {} } };
  hook(textHeader);
  hook(moneyHeader);
  assert.equal(textHeader.cell.styles.halign, "left");
  assert.equal(moneyHeader.cell.styles.halign, "right");
});

test("dynamic section guard protects the footer safety zone", () => {
  assert.equal(needsNewPdfPage(250, 15), false);
  assert.equal(needsNewPdfPage(260, 15), true);
});

test("customer CAPEX additions remain visible and reconcile to total CAPEX", () => {
  const project = {
    additionalCosts: [
      { description: "Nuovi Pali", costType: "capex", quantity: 2, unit: "pz", unitSalesPrice: 15000 },
      { description: "Sicurezza", costType: "capex", quantity: 1, unit: "pz", unitSalesPrice: 50 },
    ],
  };
  const breakdown = buildCustomerCapexRows(project, 131308, "it", 30050);
  assert.equal(breakdown.additionsTotal, 30050);
  assert.equal(breakdown.baseCapex, 101258);
  assert.match(breakdown.rows[1][0], /Nuovi Pali/);
  assert.equal(breakdown.rows.at(-1)[1], "131.308 €");
  assert.throws(() => buildCustomerCapexRows(project, 20000, "it", 30050), /exceeds total CAPEX/);
});

test("phase stack reconciles exactly to the current-cost baseline", () => {
  const row = {
    year: 1,
    currentOperatingCost: 51114,
    futureOperatingCost: 7448,
    servicePayment: 2607,
    investmentPayment: 0,
    customerSaving: 41059,
  };
  const phase = phaseFromCustomerValueRow(row, 1, 10, true, "Anni 1-10", "Smart");
  const total = phase.futureOperatingCost + phase.servicePayment + phase.investmentPayment + phase.customerSaving;
  assert.equal(total, phase.currentOperatingCost);
  assert.throws(() => phaseFromCustomerValueRow({ ...row, customerSaving: 45051 }, 1, 10, true, "", ""), /does not reconcile/);
});

test("post-contract phase uses the first actual post-service row", () => {
  const calculated = {
    analysisPeriod: 20,
    serviceAgreementPeriod: 10,
    dealType: "cash",
    customerValueRows: Array.from({ length: 20 }, (_, index) => ({
      year: index + 1,
      currentOperatingCost: 51114,
      futureOperatingCost: index < 10 ? 7448 : 6063,
      servicePayment: index < 10 ? 2607 : 0,
      investmentPayment: 0,
      customerSaving: index < 10 ? 41059 : 45051,
    })),
  };
  const { phases } = buildCostEvolutionPhases(calculated, "it");
  assert.equal(phases.length, 2);
  assert.equal(phases[0].sourceYear, 1);
  assert.equal(phases[1].sourceYear, 11);
  assert.equal(phases[0].customerSaving, 41059);
  assert.equal(phases[1].customerSaving, 45051);
});

test("report renderer keeps exact active Business Case and safe Planner workflow text", () => {
  assert.match(preliminarySource, /caseId\s*\?\s*\(rows \|\| \[\]\)\.find\(\(item\) => item\.id === caseId\)/);
  assert.doesNotMatch(preliminarySource, /projects\[0\]/);
  assert.doesNotMatch(preliminarySource, /→|⇒|➜|➝/);
  assert.match(preliminarySource, /censimento e geolocalizzazione - classificazione UNI 11248/);
});

test("visual report derives phase values from customerValueRows and not an independent PDF calculation", () => {
  assert.match(visualSource, /customerValueRows/);
  assert.match(visualSource, /rows\[serviceYears\]/);
  assert.match(visualSource, /residualSaving = currentOperatingCost - futureOperatingCost - servicePayment - investmentPayment/);
});
