import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("project price placeholders use localized two-decimal formatting", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.equal(source.includes("placeholder={String(x.cat)}"), false);
  assert.equal((source.match(/placeholder=\{formatInputNumber\(x\.cat,p\.language\)\}/g) || []).length, 2);
});
