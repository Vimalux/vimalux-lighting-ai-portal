import test from "node:test";
import assert from "node:assert/strict";
import { browserCacheProjects, writeProjectCache } from "../src/projectContext.js";

test("browser cache excludes archived cloud projects", () => {
  const active = { id: "active-1", crm: { status: "lead" } };
  const archived = { id: "archived-1", crm: { status: "archived", archivedAt: "2026-10-01T00:00:00Z" } };
  assert.deepEqual(browserCacheProjects([active, archived]), [active]);
});

test("browser cache retries after stale quota payload blocks first write", () => {
  const values = new Map([
    ["vimalux-intelligence-projects", "legacy-large-cache"],
    ["vimalux-intelligence-projects:user-1", "legacy-large-cache"],
  ]);
  let failFirstProjectWrite = true;
  const storage = {
    setItem(key, value) {
      if (failFirstProjectWrite && key.includes("vimalux-intelligence-projects")) {
        failFirstProjectWrite = false;
        throw new Error("QuotaExceededError");
      }
      values.set(key, value);
    },
    removeItem(key) { values.delete(key); },
    getItem(key) { return values.get(key) ?? null; },
  };

  const ok = writeProjectCache(storage, "user-1", [
    { id: "active-1", project: { name: "San Fele" }, crm: { status: "lead" } },
    { id: "archived-1", project: { name: "Old test" }, crm: { status: "archived", archivedAt: "x" } },
  ]);

  assert.equal(ok, true);
  const accountPayload = JSON.parse(values.get("vimalux-intelligence-projects:user-1"));
  const legacyPayload = JSON.parse(values.get("vimalux-intelligence-projects"));
  assert.equal(accountPayload.length, 1);
  assert.equal(accountPayload[0].project.name, "San Fele");
  assert.deepEqual(legacyPayload, accountPayload);
});

test("browser cache reports false when storage is unavailable", () => {
  const storage = {
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(writeProjectCache(storage, "user-1", [{ id: "active-1", crm: { status: "lead" } }]), false);
});
