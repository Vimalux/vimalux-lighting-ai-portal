import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");

test("preliminary proposal uses PDF-safe fixed Italian number and currency formatting", () => {
  assert.match(source, /function pdfNumber/);
  assert.match(source, /function pdfMoney/);
  assert.match(source, /replace\(\/\\u00a0\|\\u202f\/g, " "\)/);
  assert.match(source, /useGrouping:\s*true/);
});

test("preliminary proposal keeps typography PDF-safe", () => {
  assert.doesNotMatch(source, /CO₂/);
  assert.match(source, /Riduzione CO2/);
  assert.match(source, /font:\s*"helvetica"/);
});

test("Smart CMS fee is presented as a parenthesized deduction", () => {
  assert.match(source, /`\(\$\{money\(annualFee, lang\)\}\)`/);
  assert.doesNotMatch(source, /`− \$\{money\(annualFee, lang\)\}`/);
});

test("legacy two-page footer is not drawn before final four-page footer", () => {
  const generateBlock = source.slice(source.indexOf("function generatePdf"), source.indexOf("function showToast"));
  assert.doesNotMatch(generateBlock, /drawFooter\(doc,/);
});
