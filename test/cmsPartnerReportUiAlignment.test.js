import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("CMS partner report cards use the same commercial vocabulary as CRM", () => {
  assert.match(source, /One-off revenue/);
  assert.match(source, /Partner TCV/);
  assert.match(source, /Expected signing/);
  assert.match(source, /Products \/ quantity/);
  assert.match(source, /totals\.partnerContractValue/);
  assert.match(source, /totals\.partnerAnnualRevenue/);
});
