import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/internalProfitabilityRuntime.js", import.meta.url), "utf8");

test("internal profitability labels recurring OPEX as total excluding Adaptive Dimming", () => {
  assert.match(source, /OPEX ricorrente totale \(escluso Adaptive Dimming\)/);
  assert.match(source, /Total recurring OPEX \(excl\. Adaptive Dimming\)/);
  assert.match(source, /Tilbagevendende OPEX i alt \(ekskl\. Adaptive Dimming\)/);
});

test("Adaptive Dimming annual sales cost and margin use the same one-decimal precision", () => {
  assert.match(source, /moneyPrecise\(m\.adaptive\.revenueAnnual/);
  assert.match(source, /moneyPrecise\(m\.adaptive\.costAnnual/);
  assert.match(source, /moneyPrecise\(m\.adaptive\.marginAnnual/);
});
