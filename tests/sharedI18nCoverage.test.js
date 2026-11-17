import assert from "node:assert/strict";
import test from "node:test";
import { translationMatchesEnglish, useT } from "../src/i18n.js";

test("shared UI translations have no unreviewed English fallbacks", () => {
  // Technical acronyms, international product/service names and language autonyms
  // are intentionally retained. Other identical copy must be reviewed.
  const intentional = {
    it: ["app", "italian", "english", "capex", "cashDeal", "laas", "ppp", "co2Factor", "no", "crm", "partners"],
    da: ["app", "italian", "english", "capex", "npv", "laas", "ppp", "co2Factor", "crm", "region"],
    es: ["app", "italian", "english", "capex", "laas", "ppp", "co2Factor", "no", "crm"],
  };
  for (const language of ["it", "da", "es"]) {
    assert.deepEqual(translationMatchesEnglish(language).sort(), intentional[language].sort());
    assert.notEqual(useT(language)("customerName"), useT("en")("customerName"));
  }
});
