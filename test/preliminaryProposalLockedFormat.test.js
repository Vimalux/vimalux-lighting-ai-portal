import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../src/reportPresentation.js", import.meta.url), "utf8");

test("preliminary proposal uses shared PDF-safe Italian number and currency formatting", () => {
  assert.match(source, /function pdfNumber/);
  assert.match(source, /function pdfMoney/);
  assert.match(source, /reportNumber/);
  assert.match(source, /reportMoney/);
  assert.match(helperSource, /replace\(\/\\u00a0\|\\u202f\/g, " "\)/);
  assert.match(helperSource, /useGrouping:\s*true/);
});

test("preliminary proposal keeps typography PDF-safe", () => {
  assert.doesNotMatch(source, /CO₂/);
  assert.match(source, /Riduzione CO2/);
  assert.match(source, /PDF_FONT/);
  assert.match(helperSource, /export const PDF_FONT = "helvetica"/);
});

test("Smart CMS fee is presented as a parenthesized deduction", () => {
  assert.match(source, /`\(\$\{money\(annualFee, lang\)\}\)`/);
  assert.doesNotMatch(source, /`− \$\{money\(annualFee, lang\)\}`/);
});

test("legacy two-page footer is not drawn before final page-count footer", () => {
  const generateBlock = source.slice(source.indexOf("function generatePdf"), source.indexOf("function showToast"));
  assert.doesNotMatch(generateBlock, /drawFooter\(doc,/);
});

test("customer proposal exposes deliberate project CAPEX additions through shared reconciled helper", () => {
  assert.match(source, /buildCustomerCapexRows/);
  assert.match(source, /Composizione dell'investimento/);
  assert.match(helperSource, /project\?\.additionalCosts/);
  assert.match(helperSource, /unitSalesPrice/);
  assert.match(helperSource, /Fornitura base LED \/ Smart \/ logistica e voci standard/);
  assert.match(helperSource, /CAPEX totale/);
  assert.match(helperSource, /numericTotalCapex - additionsTotal/);
  assert.match(helperSource, /does not reconcile with Business Case summary/);
});
