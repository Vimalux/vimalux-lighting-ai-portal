import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("production entrypoint loads imported product/category reconciliation", () => {
  const source = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /import\s+"\.\/importedProductCategoryReconcile\.js"/);
});
