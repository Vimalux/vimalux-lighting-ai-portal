import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./financingAdvisorRuntime.js", import.meta.url), "utf8");

test("financing advisor saves only the changed Business Case", () => {
  assert.match(source, /saveCloudState\(\[updatedProject\]\)/);
  assert.doesNotMatch(source, /if \(supabaseConfigured\) await saveCloudState\(projects\)/);
});

test("financing advisor exposes a restore action after an applied scenario", () => {
  assert.match(source, /advisorPreviousPeriods\(project\)/);
  assert.match(source, /data-restore-duration/);
  assert.match(source, /restoreAdvisorDuration\(project\)/);
  assert.match(source, /Ripristina durata precedente/);
});

test("agent commercial-solution label is recognized by financing advisor", () => {
  assert.match(source, /soluzione\\s\+commerciale/);
});
