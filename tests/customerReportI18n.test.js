import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { customerReportCoverage, customerReportT } from "../src/customerReportCopy.js";
import { localizePdfReportText, missingPdfReportTexts } from "../src/pdfReportCopy.js";
import { reportCommercialContext } from "../src/reportCommercial.js";

test("customer report copy covers each supported language", () => {
  for (const locale of ["it", "en", "da", "es"]) assert.deepEqual(customerReportCoverage()[locale], []);
});

test("Spanish customer report includes economic content and financial caveats", () => {
  assert.equal(customerReportT("es", "executive"), "Resumen ejecutivo");
  assert.equal(customerReportT("es", "summary"), "Resumen económico del cliente");
  assert.equal(customerReportT("es", "upfront"), "Inversión inicial");
  assert.equal(customerReportT("es", "positiveStart"), "Flujo de caja positivo desde el primer mes");
  assert.equal(customerReportT("es", "no"), "No");
  assert.ok(customerReportT("es", "cashHint").includes("Compra directa"));
  assert.ok(customerReportT("es", "disclaimer").includes("autorización de VIMALUX"));
  assert.equal(customerReportT("es", "chartTitle", 10), "Evolución de costos y ahorros - 10 años");
  assert.equal(customerReportT("es", "included"), "Incluido");
});

test("report preview, chart and cash table have no Italian-only display switches", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  for (const [start, end] of [
    ["function CustomerSummary(", "function Kpis("],
    ["function Report(", "function CustomerValueChart("],
    ["function CustomerValueChart(", "function CashTable("],
    ["function CashTable(", "function Projects("],
  ]) {
    const from = app.indexOf(start);
    const to = app.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `${start} source range exists`);
    assert.doesNotMatch(app.slice(from, to), /p\.language === "it"|\bit \? /);
  }
});

test("every static bilingual PDF label is translated for Spanish and Danish", () => {
  const source = readFileSync(new URL("../src/report.js", import.meta.url), "utf8");
  const englishTexts = [...source.matchAll(/it \? "[^"]*" : "([^"]*)"/g)].map((match) => match[1]);
  assert.ok(englishTexts.length > 100, "checks all customer PDF text labels");
  for (const locale of ["es", "da"]) assert.deepEqual(missingPdfReportTexts(locale, englishTexts), [], locale);
  assert.equal(localizePdfReportText("es", "Executive Summary"), "Resumen ejecutivo");
  assert.equal(localizePdfReportText("es", "Gateway OPEX"), "OPEX de pasarela");
});

test("customer PDF commercial disclosures are translated in Spanish", () => {
  const project = { language: "es", assumptions: { dealType: "finance" } };
  const context = reportCommercialContext(project, { dealType: "finance" });
  assert.equal(context.projectType, "Solución financiada");
  assert.equal(context.includedLabel, "Incluido");
  assert.match(context.annualNetFootnote, /Beneficio neto anual/);
});
