import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "importedProductCategoryReconcile.js"), "utf8");

test("opening Intelligence does not auto-trigger catalogue reconciliation prompt", () => {
  assert.doesNotMatch(source, /setTimeout\(reconcileCurrentStoredProjectWithConfirmation, 1400\)/);
});

test("catalogue reconciliation is offered only from technical project views or file import", () => {
  assert.match(source, /data-intelligence-view="existing"/);
  assert.match(source, /data-intelligence-view="solution"/);
  assert.match(source, /input\.type !== "file"/);
});

test("catalogue reconciliation prompt identifies the project", () => {
  assert.match(source, /const projectName = String\(project\?\.project\?\.name/);
  assert.match(source, /"Progetto" : "Project"/);
});
