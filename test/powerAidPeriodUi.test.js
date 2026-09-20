import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const i18nSource = fs.readFileSync(new URL("../src/i18n.js", import.meta.url), "utf8");
const fallbackSource = fs.readFileSync(new URL("../src/servicePeriodsRuntime.js", import.meta.url), "utf8");

test("Adaptive Dimming service period is a permanent controlled assumption", () => {
  assert.match(appSource, /\["serviceAgreementPeriod",t\("serviceAgreementPeriod"\)\],\["powerAidServicePeriod",t\("powerAidServicePeriod"\)\]/);
  assert.match(appSource, /"serviceAgreementPeriod",\s*\n\s*"powerAidServicePeriod",\s*\n\s*"financingPeriod"/);
  assert.match(appSource, /path\[1\] === "powerAidServicePeriod"[\s\S]*Math\.min\(numberValue\(next\.assumptions\.serviceAgreementPeriod\)/);
});

test("Adaptive Dimming service period has customer-language labels", () => {
  assert.match(i18nSource, /powerAidServicePeriod: "Durata Adaptive Dimming \(anni\)"/);
  assert.match(i18nSource, /powerAidServicePeriod: "Adaptive Dimming service period \(years\)"/);
  assert.match(i18nSource, /powerAidServicePeriod:"Adaptive Dimming-serviceperiode \(år\)"/);
});

test("legacy service-period runtime does not duplicate the native field", () => {
  assert.match(fallbackSource, /if \(findField\(\/durata\\s\+adaptive/);
});
