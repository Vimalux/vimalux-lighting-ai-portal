import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mainPath = fileURLToPath(new URL("../src/main.jsx", import.meta.url));
const mainSource = readFileSync(mainPath, "utf8");

test("production entrypoint wires the re-import overwrite confirmation guard", () => {
  assert.match(mainSource, /import\s+["']\.\/reimportConfirmGuard\.js["'];?/);
});
