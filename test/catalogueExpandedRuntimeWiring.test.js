import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("catalogue expanded-state runtime is loaded from main", () => {
  const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(main, /catalogueExpandedStateRuntime\.js/);
});
