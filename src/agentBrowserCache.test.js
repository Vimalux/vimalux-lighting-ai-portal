import test from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_OWNER_KEY,
  PROJECTS_KEY,
  accountKey,
  clearAgentProjectCache,
} from "./projectContext.js";

function makeStorage(initial) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()],
  };
}

test("only fully synced agent caches are removed; other accounts are preserved", () => {
  const agentId = "agent-123";
  const cache = JSON.stringify([{ id: "case-1", updatedAt: "2026-11-01T00:00:00Z" }]);
  const storage = makeStorage({
    [accountKey(PROJECTS_KEY, agentId)]: cache,
    [PROJECTS_KEY]: cache,
    [CACHE_OWNER_KEY]: agentId,
    [accountKey(PROJECTS_KEY, "admin-2")]: JSON.stringify([{ id: "admin-draft" }]),
  });
  assert.equal(clearAgentProjectCache(storage, agentId, [{ id: "case-1", updatedAt: "2026-11-02T00:00:00Z" }]), true);
  assert.equal(storage.getItem(PROJECTS_KEY), null);
  assert.equal(storage.getItem(accountKey(PROJECTS_KEY, agentId)), null);
  assert.ok(storage.getItem(accountKey(PROJECTS_KEY, "admin-2")));
});

test("unsynced legacy agent drafts are retained for recovery", () => {
  const agentId = "agent-123";
  const draft = JSON.stringify([{ id: "unsynced-draft", updatedAt: "2026-11-16T00:00:00Z" }]);
  const storage = makeStorage({
    [accountKey(PROJECTS_KEY, agentId)]: draft,
    [PROJECTS_KEY]: draft,
    [CACHE_OWNER_KEY]: agentId,
  });
  assert.equal(clearAgentProjectCache(storage, agentId, [{ id: "case-1" }]), false);
  assert.equal(storage.getItem(PROJECTS_KEY), draft);
});
