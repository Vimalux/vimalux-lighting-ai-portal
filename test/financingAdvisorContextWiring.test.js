import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const financingRuntime = fs.readFileSync(
  new URL("../src/financingAdvisorRuntime.js", import.meta.url),
  "utf8",
);
const activeContextRuntime = fs.readFileSync(
  new URL("../src/activeProjectContextRuntime.js", import.meta.url),
  "utf8",
);
const newProjectGuard = fs.readFileSync(
  new URL("../src/newProjectContextGuard.js", import.meta.url),
  "utf8",
);

test("SAFE RELEASE: financing advisor resolves the same active Business Case context as the platform", () => {
  assert.match(financingRuntime, /resolveActiveProjectIndex/);
  assert.match(financingRuntime, /headerText:/);
  assert.match(financingRuntime, /vimalux-intelligence-active-business-case/);
  assert.match(activeContextRuntime, /resolveProjectByReference/);
  assert.match(activeContextRuntime, /businessCaseCodeFromText/);
});

test("SAFE RELEASE: newly rendered stable Business Case replaces stale remembered context", () => {
  assert.match(activeContextRuntime, /if \(stableCloudId !== urlRef\) replaceBusinessCaseInUrl\(stableCloudId\)/);
  assert.match(activeContextRuntime, /rememberBusinessCaseId\(stableCloudId\)/);
  assert.match(activeContextRuntime, /readNewProjectContext\(\)/);
  assert.match(newProjectGuard, /business_case_id/);
  assert.match(newProjectGuard, /localStorage\.removeItem\(ACTIVE_CASE_STORAGE_KEY\)/);
  assert.match(newProjectGuard, /capture phase/i);
});
