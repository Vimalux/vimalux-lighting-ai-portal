import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("cloud hydration never treats customer/project/file-name identity as authoritative project identity", () => {
  const source = fs.readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /isSameImportedProject\(cloud, item\)/);
});

test("import identity reconciliation is opt-in only for an explicit project-file import", () => {
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const start = app.indexOf("const activateImportedProject");
  const end = app.indexOf("const importProjectFile", start);
  const block = app.slice(start, end);
  assert.match(block, /dedupeImportIdentity:\s*true/);
});

test("normal autosave deduplication does not opt into name-based import identity", () => {
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const autosaveStart = app.indexOf("saveCloudState(batch)");
  const autosaveEnd = app.indexOf("catch((error)", autosaveStart);
  const block = app.slice(autosaveStart, autosaveEnd);
  assert.doesNotMatch(block, /dedupeImportIdentity:\s*true/);
});
