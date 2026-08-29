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
});

test("cashflow table explicitly includes year zero initial outlay", () => {
  assert.match(pageSource, /year:\s*0/);
  assert.match(pageSource, /initialOutlay/);
  assert.match(pageSource, /netCashFlow:\s*-initialOutlay/);
  assert.match(pageSource, /cumulative:\s*openingCash/);
});

test("dashboard headings are positioned independently and PDF-safe CO2 text is used", () => {
  assert.match(pageSource, /sectionAt\(it \? "Costo energetico annuo"/);
  assert.match(pageSource, /sectionAt\(it \? "Composizione beneficio annuo"/);
  assert.doesNotMatch(pageSource, /CO₂/);
});
