import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./defaultAssumptionsRuntime.js", import.meta.url), "utf8");

test("default assumptions modal uses explicit display state instead of hidden attribute", () => {
  assert.match(source, /function hideModal\(overlay\)/);
  assert.match(source, /overlay\.style\.display = "none"/);
  assert.match(source, /function showModal\(overlay\)/);
  assert.match(source, /overlay\.style\.display = "flex"/);
  assert.doesNotMatch(source, /overlay\.hidden = true/);
});

test("save and close actions both close the modal", () => {
  assert.match(source, /data-default-close[\s\S]*hideModal\(overlay\)/);
  assert.match(source, /localStorage\.setItem\(DEFAULT_ASSUMPTIONS_STORAGE_KEY[\s\S]*hideModal\(overlay\)/);
});
