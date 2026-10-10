import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = fs.readFileSync(path.join(here, "App.jsx"), "utf8");

test("autosave persists only the accumulated dirty batch, not the whole portfolio", () => {
  assert.match(appSource, /changedProjects\(observedProjectsRef\.current, projects\)/);
  assert.match(appSource, /pendingSaveRef\.current\.set\(item\.id, item\)/);
  assert.match(appSource, /const batch = \[\.\.\.pendingSaveRef\.current\.values\(\)\]/);
  assert.match(appSource, /saveCloudState\(batch\)/);
  assert.doesNotMatch(appSource, /setTimeout\(\(\) => saveCloudState\(projects\)/);
});

test("autosave calls are serialized", () => {
  assert.match(appSource, /saveQueueRef\.current = saveQueueRef\.current/);
  assert.match(appSource, /\.then\(\(\) => saveCloudState\(batch\)\)/);
});

test("agent promotion preserves same-session owner editability", () => {
  assert.match(appSource, /agentId: item\.crm\?\.agentId \|\| \(isAgent \? userId : ""\)/);
  assert.match(appSource, /agentAccessMode: item\.crm\?\.agentAccessMode \|\| \(isAgent \? "owner" : ""\)/);
});

test("cloud hydration resets dirty baseline before autosave", () => {
  assert.match(appSource, /observedProjectsRef\.current = merged;/);
  assert.match(appSource, /pendingSaveRef\.current\.clear\(\);/);
});
