import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const autoSource = readFileSync(new URL("../src/proposalVisualAuto.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/proposalVisualPages.js", import.meta.url), "utf8");

test("preliminary visual pages never fall back to another local project", () => {
  assert.doesNotMatch(autoSource, /\|\|\s*projects\[0\]/);
  assert.match(autoSource, /businessCaseCodeFromFilename/);
  assert.match(autoSource, /businessCaseRecordId/);
  assert.match(autoSource, /throw new Error\("Impossibile associare il PDF al Business Case attivo/);
});

test("four-page proposal footer is redrawn after visual pages are appended", () => {
  assert.match(autoSource, /appendProposalVisualPages\(this, project/);
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

test("page three mirrors dashboard cost evolution and keeps PDF-safe CO2 text", () => {
  assert.match(pageSource, /Evoluzione dei costi e dei risparmi/);
  assert.match(pageSource, /function costEvolutionChart/);
  assert.match(pageSource, /currentOperatingCost/);
  assert.match(pageSource, /futureOperatingCost/);
  assert.match(pageSource, /servicePayment/);
  assert.match(pageSource, /investmentPayment/);
  assert.match(pageSource, /customerSaving/);
  assert.doesNotMatch(pageSource, /Costo energetico annuo/);
  assert.doesNotMatch(pageSource, /Composizione beneficio annuo/);
  assert.doesNotMatch(pageSource, /CO₂/);
});
