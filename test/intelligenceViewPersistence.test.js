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

test("Intelligence continuity restores on browser return without locking manual navigation", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\["cms partners", "datek"\]/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /lastUserNavigationAt = Date\.now\(\)/);
  assert.match(source, /clearTimeout\(restoreTimer\)/);
  assert.match(source, /if \(!restoringView\)/);
  assert.match(source, /const observer = new MutationObserver\(refresh\)/);
  assert.match(source, /const refresh = \(\) => \{\s*enforceAllMppt\(\);\s*\};/);
  assert.doesNotMatch(source, /const refresh = \(\) => \{[\s\S]*?scheduleRestore\(\);[\s\S]*?\};/);
});

test("Intelligence captures the actually active view before browser leave", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /function rememberActiveView\(\)/);
  assert.match(source, /const active = activeNavCandidate\(\)/);
  assert.match(source, /if \(document\.hidden\) \{[\s\S]*?rememberActiveView\(\)/);
  assert.match(source, /window\.addEventListener\("blur", \(\) => \{[\s\S]*?rememberActiveView\(\)/);
  assert.match(source, /window\.addEventListener\("pagehide", \(\) => \{[\s\S]*?rememberActiveView\(\)/);
});
