import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  continuityRestoreSignature,
  isProjectContinuityView,
  projectViewFromNavigation,
} from "../src/intelligenceUiContinuityRuntime.js";

test("continuity signature changes when the active menu drifts away from the saved view", () => {
  const ref = "ed7023d5-7b18-492c-9a82-2dbdf04ddb9e";
  const saved = continuityRestoreSignature(ref, "report", "report");
  const drifted = continuityRestoreSignature(ref, "report", "customer");
  assert.notEqual(saved, drifted);
});

test("only Business Case workflow views are eligible for browser-return continuity", () => {
  for (const view of ["customer", "existing", "solution", "additionalCosts", "pricing", "assumptions", "business", "report", "orderList"]) {
    assert.equal(isProjectContinuityView(view), true, `${view} should be restorable`);
  }
  for (const view of ["crm", "datek", "partnerReports", "projects", "catalogue", "admin", "internalReport", "defaults"]) {
    assert.equal(isProjectContinuityView(view), false, `${view} must never take over a Business Case`);
  }
});

test("numbered and translated workflow buttons use stable view identity", () => {
  for (const textContent of ["3Løsning", "3Soluzione", "3Solution"]) {
    assert.equal(projectViewFromNavigation({ dataset: { intelligenceView: "solution" }, textContent }), "solution");
  }
  for (const textContent of ["Ordreliste", "Lista ordini", "Order List"]) {
    assert.equal(projectViewFromNavigation({ dataset: { intelligenceView: "orderList" }, textContent }), "orderList");
  }
  assert.equal(projectViewFromNavigation({ dataset: { intelligenceView: "admin" }, textContent: "Report" }), null);
  assert.equal(projectViewFromNavigation(null), null);
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

test("explicit navigation to a global or admin view disables Business Case restore", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function disableProjectRestore\(\)/);
  assert.match(source, /restoreOnReturn = false;\s*restoreUntil = 0;\s*clearExplicitView\(\)/);
  assert.match(source, /Explicit navigation to a global\/admin area disables project restore/);
  assert.match(source, /else \{\s*\/\/ Explicit navigation to a global\/admin area disables project restore\.\s*disableProjectRestore\(\);\s*\}/);
});

test("project workflow view survives late Supabase hydration after browser return", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /const RETURN_RESTORE_WINDOW_MS = 10000/);
  assert.match(source, /\[140, 850, 1700, 3500, 7000\]\.forEach/);
  assert.match(source, /restoreUntil = Date\.now\(\) \+ RETURN_RESTORE_WINDOW_MS/);
  assert.match(source, /queueMicrotask\(restoreView\)/);
  assert.match(source, /attributeFilter: \["class", "aria-current"\]/);
  assert.match(source, /window\.addEventListener\("focus", scheduleReturnRestore\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /captureProjectViewBeforeLeave\(\)/);
});

test("blur capture only trusts active Business Case nav and preserves the last explicit project view", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function activeProjectCandidate\(\) \{\s*return projectNavCandidates\(\)\.find\(isActiveCandidate\) \|\| null;/);
  assert.match(source, /const activeProject = activeProjectCandidate\(\)/);
  assert.match(source, /if \(!activeProjectView && lastExplicitRef === ref && PROJECT_VIEW_IDS\.has\(lastExplicitView\)\)/);
  assert.match(source, /Lack of an active Business Case item during blur is not evidence/);
  assert.match(source, /if \(!activeProjectView\) \{\s*restoreOnReturn = false;\s*restoreUntil = 0;\s*clearRestoreTimers\(\);\s*return;/);
});

test("manual project navigation remains authoritative during the bounded return window", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /rememberManualProjectView\(nav\)/);
  assert.match(source, /if \(nav && !restoringView\)/);
  assert.match(source, /lastUserNavigationAt = Date\.now\(\)/);
  assert.match(source, /if \(Date\.now\(\) - lastUserNavigationAt < USER_NAVIGATION_GRACE_MS\) return/);
});
