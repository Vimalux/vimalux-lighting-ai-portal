import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Hybrid panel shows integrated Business Case benefit and no stale preview wording", () => {
  const source = fs.readFileSync(new URL("../src/HybridSummary.jsx", import.meta.url), "utf8");
  assert.match(source, /Hybrid Benefit annuo/);
  assert.match(source, /hybridSolarSavingEUR/);
  assert.match(source, /included in BC/);
  assert.doesNotMatch(source, /does not yet change the existing LED Business Case|non modifica ancora il Business Case/i);
});
