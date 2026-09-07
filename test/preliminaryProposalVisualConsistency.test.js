import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const autoSource = readFileSync(new URL("../src/proposalVisualAuto.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/proposalFinalVisualPages.js", import.meta.url), "utf8");
const costPageSource = readFileSync(new URL("../src/proposalCostEvolutionPage.js", import.meta.url), "utf8");

test("preliminary visual pages never fall back to another local project", () => {
  assert.doesNotMatch(autoSource, /\|\|\s*projects\[0\]/);
  assert.match(autoSource, /businessCaseCodeFromFilename/);
  assert.match(autoSource, /businessCaseRecordId/);
  assert.match(autoSource, /throw new Error\("Impossibile associare il PDF al Business Case attivo/);
});

test("proposal footer is redrawn after final visual pages are appended", () => {
  assert.match(autoSource, /appendFinalProposalVisualPages\(this, project/);
  assert.match(autoSource, /redrawFourPageFooters\(this, project, filename\)/);
  assert.match(autoSource, /\$\{page\}\/\$\{pages\}/);
  assert.match(autoSource, /doc\.rect\(0, 278, 210, 19, "F"\)/);
});

test("cashflow table explicitly includes year zero initial outlay", () => {
  assert.match(pageSource, /year:\s*0/);
  assert.match(pageSource, /initialOutlay/);
  assert.match(pageSource, /netCashFlow:\s*-initialOutlay/);
  assert.match(pageSource, /cumulative:\s*openingCash/);
});

test("cash deals use break-even cards instead of the cumulative chart", () => {
  assert.match(pageSource, /isCashDeal/);
  assert.match(pageSource, /Beneficio netto anno 1/);
  assert.match(pageSource, /Break-even/);
  assert.match(pageSource, /if \(isCashDeal\)[\s\S]*else \{[\s\S]*lineChart/);
});

test("cost evolution is drawn only from the reconciled year-one phase model", () => {
  assert.match(pageSource, /doc\.addPage\(\);[\s\S]*repairCostEvolutionProposalPage/);
  assert.match(costPageSource, /buildYearOneCustomerValuePhases/);
  assert.match(costPageSource, /Confronto delle fasi a prezzi costanti dell'anno 1/);
  assert.match(costPageSource, /Hybrid Solar incluso/);
  assert.doesNotMatch(autoSource, /appendProposalVisualPages/);
  assert.doesNotMatch(autoSource, /costEvolutionPage = this\.getNumberOfPages/);
});
