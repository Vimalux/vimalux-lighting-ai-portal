import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { businessT, missingBusinessTranslations } from "../src/businessCopy.js";
import { customerReportT } from "../src/customerReportCopy.js";

test("economic analysis labels are complete for every supported language", () => {
  for (const missing of Object.values(missingBusinessTranslations())) assert.deepEqual(missing, []);
  assert.equal(businessT("es", "assessment", 10),
    "La evaluación del cliente se basa en el beneficio neto anual y el VAN durante los 10 años del período de análisis.");
  assert.equal(businessT("es", "annualOpexPerLuminaire"), "OPEX anual por luminaria");
  assert.equal(businessT("es", "cashBreakEven"), "Equilibrio del flujo de caja acumulado");
  assert.equal(businessT("es", "year"), "Año");
});

test("economic analysis and KPI components use the selected locale", () => {
  const source = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  for (const [start, end] of [["function Kpis(", "function Business("], ["function Business(", "function InternalReport("]]) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from);
    assert.ok(from >= 0 && to > from, start);
    const section = source.slice(from, to);
    assert.doesNotMatch(section, /p\.language === "it"|\bit \? /, start);
    assert.match(section, /businessT\(p\.language,/);
  }
});

test("report horizon and hybrid chart refreshes respect Spanish", () => {
  const horizon = readFileSync(new URL("../src/contractChartHorizonRuntime.js", import.meta.url), "utf8");
  const hybrid = readFileSync(new URL("../src/reportHybridRuntime.js", import.meta.url), "utf8");
  assert.match(horizon, /customerReportT\(language, "limitedCashflowHint"/);
  assert.match(horizon, /customerReportT\(language, "chartTitle"/);
  assert.match(hybrid, /saving\.textContent = .*s\("year"\)/);
  assert.equal(customerReportT("es", "limitedCashflowHint", 10),
    "Detalle anual limitado al período contractual y de servicios de 10 años, con beneficio bruto, OPEX, pagos y flujo neto de caja del cliente.");
  assert.match(customerReportT("es", "hybridChartNote", "100 EUR", "200"), /año/);
});
