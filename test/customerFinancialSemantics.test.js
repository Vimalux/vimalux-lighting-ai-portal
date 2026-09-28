import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";

test("cashBreakEvenYear equals first full year with non-negative cumulative customer cash flow", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  const result = calculateBusinessCase(project);
  const expected = result.cashFlowRows.find((row) => Number(row.cumulative) >= 0)?.year ?? null;
  assert.equal(result.cashBreakEvenYear, expected);
});

test("Economic Analysis separates cash payback from financed customer semantics", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow cliente positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto/);
  assert.match(source, /indipendenti dalla struttura di finanziamento/);
});

test("PDF Executive Summary uses model-specific semantics and retains technical metrics only as secondary information for financed deals", () => {
  const source = fs.readFileSync(new URL("../src/report.js", import.meta.url), "utf8");
  assert.match(source, /const executiveHead = cashDeal/);
  assert.match(source, /CAPEX iniziale cliente/);
  assert.match(source, /Break-even cash cumulato/);
  assert.match(source, /Cash flow positivo dal primo anno/);
  assert.match(source, /Metriche tecniche del progetto - indipendenti dal finanziamento/);
});
