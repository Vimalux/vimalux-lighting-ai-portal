import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  continuityRestoreSignature,
  isProjectContinuityView,
} from "../src/intelligenceUiContinuityRuntime.js";

test("continuity signature changes when the active menu drifts away from the saved view", () => {
  const ref = "ed7023d5-7b18-492c-9a82-2dbdf04ddb9e";
  const saved = continuityRestoreSignature(ref, "report", "report");
  const drifted = continuityRestoreSignature(ref, "report", "customer");
  assert.notEqual(saved, drifted);
});

test("only Business Case workflow views are eligible for browser-return continuity", () => {
  for (const view of ["customer", "existing", "solution", "additionalCosts", "pricing", "assumptions", "business", "report"]) {
    assert.equal(isProjectContinuityView(view), true, `${view} should be restorable`);
  }
  for (const view of ["crm", "datek", "partnerReports", "projects", "catalogue", "admin", "internalReport", "defaults"]) {
    assert.equal(isProjectContinuityView(view), false, `${view} must never take over a Business Case`);
  }
});

test("CMS Partners and other global views cannot be stored or restored under a Business Case", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /const PROJECT_VIEW_LABELS = new Map/);
  assert.doesNotMatch(source, /\["cms partners", "datek"\]/);
  assert.doesNotMatch(source, /\["crm", "crm"\]/);
  assert.match(source, /if \(!parsed \|\| typeof parsed !== "object" \|\| !PROJECT_VIEW_IDS\.has\(parsed\.view\)\) return null/);
  assert.match(source, /if \(!PROJECT_VIEW_IDS\.has\(view\)\) return/);
});

test("leaving from a global or admin view disables Business Case restore", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function captureProjectViewBeforeLeave\(\)/);
  assert.match(source, /if \(!activeProjectView\) \{\s*restoreOnReturn = false;\s*clearExplicitView\(\)/);
  assert.match(source, /Explicit navigation to a global\/admin area disables project restore/);
  assert.match(source, /restoreOnReturn = false;\s*clearExplicitView\(\)/);
});

test("project workflow view is restored after the Supabase refresh window", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[140, 850, 1700\]\.forEach/);
  assert.match(source, /window\.addEventListener\("focus", scheduleReturnRestore\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /captureProjectViewBeforeLeave\(\)/);
  assert.match(source, /if \(!restoreOnReturn\) return/);
});

test("manual project navigation stays authoritative and catalogue mutation observer does not navigate", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /rememberManualProjectView\(nav\)/);
  assert.match(source, /if \(nav && !restoringView\)/);
  assert.match(source, /const observer = new MutationObserver\(refresh\)/);
  assert.doesNotMatch(source, /const observer = new MutationObserver\([^)]*scheduleReturnRestore/);
  assert.doesNotMatch(source, /DOMContentLoaded[\s\S]{0,160}scheduleReturnRestore/);
});
