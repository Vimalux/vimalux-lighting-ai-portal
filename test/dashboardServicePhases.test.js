import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("dashboard phases follow CMS and PowerAiD state changes independently", () => {
  assert.match(source, /phaseKey = \(row\) => `\$\{Boolean\(row\?\.cmsActive\)\}\|\$\{Boolean\(row\?\.powerAidActive\)\}/);
  assert.match(source, /CMS \+ PowerAiD/);
  assert.match(source, /Solo CMS/);
  assert.match(source, /Post-servizi/);
});

test("dashboard full-period note requires every configured Smart service to remain active", () => {
  assert.match(source, /allConfiguredServicesFullPeriod/);
  assert.match(source, /powerAidServicePeriod/);
  assert.doesNotMatch(source, /const postContract = r\.serviceAgreementPeriod < r\.analysisPeriod/);
});

test("dashboard phase comparison is normalized to year-one prices", () => {
  assert.match(source, /buildDashboardYearOneScenario/);
  assert.match(source, /ledEnergySavingEUR/);
  assert.match(source, /cloSavingEUR/);
  assert.match(source, /powerAidGrossSavingEUR/);
  assert.match(source, /Energia \+ manutenzione/);
});
