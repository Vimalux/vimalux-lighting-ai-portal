import assert from "node:assert/strict";
import test from "node:test";
import { vatT, vatTranslationCoverage } from "../src/vatCopy.js";
import { sectionT, sectionTranslationCoverage } from "../src/uiSectionsCopy.js";
import { customerVatSubject, customerVatTypeLabel, customerVatDisclosure } from "../src/customerVatProfile.js";

  test("covers every VAT and settings key in every supported language", () => {
    for (const language of ["it", "en", "da", "es"]) {
      assert.deepEqual(vatTranslationCoverage()[language], []);
      assert.deepEqual(sectionTranslationCoverage()[language], []);
    }
  });

  test("uses Spanish VAT, dimming and administration copy when Spanish is selected", () => {
    assert.equal(vatT("es", "title"), "IVA y flujo de caja del cliente");
    assert.ok(vatT("es", "recoverableByCustomer").includes("cliente"));
    assert.ok(sectionT("es", "dimmingTitle").includes("regulación"));
    assert.equal(sectionT("es", "applyFirstRow", 3), "Aplicar la primera fila a 3 grupos");
    assert.ok(sectionT("es", "dataResetWarning").includes("datos locales"));
    assert.equal(sectionT("es", "openPricing"), "Abrir precios del proyecto");
  });

  test("preserves the customer VAT metadata in all languages", () => {
    const project = {
      customer: { customerType: "municipality" },
      assumptions: { vatRecoverability: "non_deductible" },
    };
    assert.equal(customerVatSubject(project, "es"), "municipio");
    assert.equal(customerVatTypeLabel(project, "es"), "Municipio / entidad pública");
    for (const language of ["es", "da", "it", "en"]) assert.ok(customerVatDisclosure(project, language).includes("0%"));
  });
