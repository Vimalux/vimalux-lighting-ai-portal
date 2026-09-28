import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { defaultProject } from "../src/model.js";
import { legacyProjectId } from "../src/businessCasePersistence.js";

const contextGuard = fs.readFileSync(new URL("../src/newProjectContextGuard.js", import.meta.url), "utf8");
const activeContext = fs.readFileSync(new URL("../src/activeProjectContextRuntime.js", import.meta.url), "utf8");

test("SAFE RELEASE: new project clears previous URL and remembered Business Case context", () => {
  assert.match(contextGuard, /url\.searchParams\.delete\(key\)/);
  assert.match(contextGuard, /localStorage\.removeItem\(ACTIVE_CASE_STORAGE_KEY\)/);
  assert.match(contextGuard, /sessionStorage\.setItem\(NEW_PROJECT_CONTEXT_KEY/);
  assert.match(contextGuard, /previousBusinessCase/);
});

test("SAFE RELEASE: active context cannot restore the previous case while a new draft is being promoted", () => {
  assert.match(activeContext, /readNewProjectContext\(\)/);
  assert.match(activeContext, /previousStable && stableCloudId === previousStable/);
  assert.match(activeContext, /if \(!stableCloudId/);
  assert.match(activeContext, /clearNewProjectContext\(\)/);
});

test("SAFE RELEASE: URL and remembered active Business Case only use stable cloud UUIDs", () => {
  assert.match(activeContext, /stableUuid\.test\(value\)/);
  assert.match(activeContext, /if \(!stable\) return;/);
  assert.doesNotMatch(activeContext, /String\(match\?\.crm\?\.businessCaseRecordId \|\| match\?\.id \|\| ref/);
});

test("SAFE RELEASE: human BC display codes can never become draft legacy identities", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.id = project.project.businessCaseId;
  project.crm.legacyIntelligenceId = "";
  assert.match(project.id, /^BC-/);
  assert.equal(legacyProjectId(project), "");
});

test("SAFE RELEASE: ordinary local ids remain valid idempotency identities", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.id = "local-draft-123";
  project.crm.legacyIntelligenceId = "";
  assert.equal(legacyProjectId(project), "local-draft-123");
});
