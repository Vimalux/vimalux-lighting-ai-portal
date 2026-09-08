import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { continuityRestoreSignature } from "../src/intelligenceUiContinuityRuntime.js";

test("continuity signature changes when the active menu drifts away from the saved view", () => {
  const ref = "ed7023d5-7b18-492c-9a82-2dbdf04ddb9e";
  const saved = continuityRestoreSignature(ref, "report", "report");
  const drifted = continuityRestoreSignature(ref, "report", "customer");
  assert.notEqual(saved, drifted);
});

test("manual Intelligence navigation is authoritative and programmatic restore cannot overwrite it", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /let lastExplicitView = ""/);
  assert.match(source, /let lastExplicitRef = ""/);
  assert.match(source, /function rememberManualView\(element\)/);
  assert.match(source, /&& !restoringView\) \{/);
  assert.match(source, /rememberManualView\(nav\)/);
  assert.doesNotMatch(source, /if \(!restoringView\)[\s\S]*?rememberFromElement\(nav\)/);
});

test("browser return restores the saved view after the async Supabase refresh window", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[140, 850, 1700\]\.forEach/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /if \(hasLeftBrowser\) scheduleReturnRestore\(\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /rememberCurrentViewBeforeLeave\(\)/);
});

test("stale persisted CMS state cannot beat the latest explicit project view", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(lastExplicitView && lastExplicitRef === ref\) \{\s*return \{ view: lastExplicitView, label: "" \};/);
  assert.match(source, /if \(lastExplicitView && lastExplicitRef === ref\) \{\s*writeStoredView\(ref, lastExplicitView\)/);
  assert.match(source, /element\.classList\.contains\("active"\)/);
  assert.doesNotMatch(source, /parentElement\?\.classList\.contains\("active"\)/);
});

test("continuity uses the real App view id for price administration and does not restore on initial load", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\["amministrazione prezzi", "admin"\]/);
  assert.match(source, /\["price administration", "admin"\]/);
  assert.doesNotMatch(source, /scheduleRestore\(450\)/);
  assert.match(source, /event\.persisted && hasLeftBrowser/);
});
