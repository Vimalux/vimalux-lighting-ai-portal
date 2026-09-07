import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Hybrid proposal page keeps PV production separate from Business Case grid offset", () => {
  const source = fs.readFileSync(new URL("./hybridProposalPage.js", import.meta.url), "utf8");
  assert.match(source, /annualPvKwh/);
  assert.match(source, /annualGridOffsetKwh/);
  assert.match(source, /gridOffsetKwh = usableSolarKwh \* includedRatio/);
  assert.match(source, /Il beneficio economico coincide con l'offset rete incluso nel Business Case/);
});
