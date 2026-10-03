import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("active project context resolves BC code to stable Business Case record ID only", () => {
  const source = fs.readFileSync(
    new URL("../src/activeProjectContextRuntime.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /function stableRecordId\(ref\)/);
  assert.match(source, /function projectForBusinessCase\(ref\)/);
  assert.match(source, /const explicit = String\(params\.get\("business_case_id"\)/);
  assert.match(source, /if \(stable && stable !== explicit\) replaceBusinessCaseInUrl\(stable\)/);
  assert.match(source, /const urlRef = String\(currentParams\(\)\.get\("business_case_id"\)/);
  assert.match(source, /const stable = String\(match\?\.crm\?\.businessCaseRecordId \|\| match\?\.id \|\| ""\)/);
  assert.match(source, /const stableCloudId = stableUuid\.test\(stable\) \? stable : ""/);
  assert.match(source, /if \(!stable\) return/);
  assert.doesNotMatch(source, /small\.dataset\.businessCaseId/);
});

test("new-project context blocks restoration of the previously viewed Business Case", () => {
  const source = fs.readFileSync(
    new URL("../src/activeProjectContextRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /const newProjectContext = readNewProjectContext\(\)/);
  assert.match(source, /previousStable && stableCloudId === previousStable/);
  assert.match(source, /clearNewProjectContext\(\)/);
});
