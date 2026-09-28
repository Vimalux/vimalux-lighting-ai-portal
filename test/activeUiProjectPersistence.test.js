import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("SAFE RELEASE: last active UI project survives F5 when no explicit Business Case link is present", () => {
  assert.match(app, /const ACTIVE_UI_PROJECT_KEY = "vimalux-intelligence-active-ui-project"/);
  assert.match(app, /const requestedProject = findLinkedProject\(initial, requestedId\)/);
  assert.match(app, /if \(requestedProject\) return requestedProject\.id/);
  assert.match(app, /localStorage\.getItem\(ACTIVE_UI_PROJECT_KEY\)/);
  assert.match(app, /initial\.some\(\(item\) => item\.id === rememberedId\) \? rememberedId/);
  assert.match(app, /localStorage\.setItem\(ACTIVE_UI_PROJECT_KEY, activeId\)/);
});

test("SAFE RELEASE: explicit stable Business Case navigation remains authoritative over remembered UI state", () => {
  const explicitIndex = app.indexOf("if (requestedProject) return requestedProject.id");
  const rememberedIndex = app.indexOf("localStorage.getItem(ACTIVE_UI_PROJECT_KEY)");
  assert.ok(explicitIndex >= 0 && rememberedIndex > explicitIndex);
});

test("SAFE RELEASE: cloud promotion still replaces the local active id with the stable case UUID", () => {
  assert.match(app, /setActiveId\(\(current\) => promotions\.find\(\(entry\) => entry\.legacyId === current\)\?\.caseId \|\| current\)/);
});
