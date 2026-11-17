import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { solutionT, solutionTranslationCoverage } from "../src/solutionCopy.js";

test("solution settings have complete IT/EN/DA/ES message dictionaries", () => {
  for (const language of ["it", "en", "da", "es"]) {
    assert.deepEqual(solutionTranslationCoverage()[language], []);
  }
});

test("Spanish solution texts include explanations, action buttons and price summary", () => {
  assert.equal(solutionT("es", "warranty"), "Garantía de las luminarias");
  assert.ok(solutionT("es", "warrantyHint", 5, "18,19").includes("18,19"));
  assert.equal(solutionT("es", "addCmsProduct"), "Añadir producto DATEK / CMS");
  assert.ok(solutionT("es", "lcuIncluded").includes("automáticamente"));
  assert.equal(solutionT("es", "summary"), "Resumen de la solución seleccionada");
  assert.equal(solutionT("es", "automaticQuantity", 100), "Automático: 100 unidades (igual al número de luminarias seleccionadas)");
});

test("Solution, warranty and partner equipment components use the shared locale keys", () => {
  const sources = ["App.jsx", "WarrantySelector.jsx", "PartnerEquipmentSelector.jsx"];
  for (const name of sources) {
    const source = readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
    assert.match(source, /solutionT/);
  }
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const source = app.slice(app.indexOf("function Solution("), app.indexOf("const Breakdown ="));
  assert.doesNotMatch(source, /p\.language === "it"/);
});
