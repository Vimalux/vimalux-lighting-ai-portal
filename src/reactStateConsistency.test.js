import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("rapid Solution and Adaptive Dimming changes resolve the current project inside the state update", () => {
  assert.match(appSource, /const currentProject = all\.find\(\(item\) => item\.id === activeId\)/);
  assert.match(appSource, /const project = currentProject;[\s\S]*sanitizeAgentAdditionalCosts\(project\.additionalCosts, value\)/);
  assert.match(appSource, /changeCmsPartner\(next, normalized\)/);
  assert.match(appSource, /changeAdaptiveDimmingPartner\(next, normalized\)/);
});
