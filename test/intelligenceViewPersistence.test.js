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

test("Intelligence continuity listens for browser focus and maps CMS Partners to the real datek view", () => {
  const source = fs.readFileSync(
    new URL("../src/intelligenceUiContinuityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\["cms partners", "datek"\]/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /const activeView = activeCandidate/);
  assert.match(source, /continuityRestoreSignature\(currentBusinessCaseRef\(\), saved\.view, activeView\)/);
});
