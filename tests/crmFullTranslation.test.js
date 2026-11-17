import assert from "node:assert/strict";
import test from "node:test";
import { crmT, crmTranslationCoverage } from "../src/crmCopy.js";

test("CRM opportunity copy has a translated value for every supported language", () => {
  assert.deepEqual(crmTranslationCoverage(), { en: [], it: [], da: [], es: [] });
});

test("CRM translation changes labels without changing stored pipeline identifiers", () => {
  const translated = ["en", "it", "da", "es"].map((language) => crmT(language, "won"));
  assert.deepEqual(translated, ["Won", "Vinta", "Vundet", "Ganada"]);
  assert.notEqual(crmT("es", "archiveDisclosure"), crmT("en", "archiveDisclosure"));
});
