import assert from "node:assert/strict";
import test from "node:test";
import { canRefreshAgentPortfolio, hasNewAgentCloudData } from "./agentCloudRefresh.js";

const project = (id, syncVersion, lastSyncedAt = "2026-11-16T18:00:00Z") => ({
  id, crm: { syncVersion, lastSyncedAt, agentAccessMode: "owner", status: "lead" },
});

test("agent refresh never replaces pending, unsaved, or actively edited work", () => {
  const current = [project("case-a", 1)];
  const safe = { syncState: "saved", pendingSaveCount: 0, observed: current, current, editing: false };
  assert.equal(canRefreshAgentPortfolio(safe), true);
  assert.equal(canRefreshAgentPortfolio({ ...safe, syncState: "saving" }), false);
  assert.equal(canRefreshAgentPortfolio({ ...safe, syncState: "error" }), false);
  assert.equal(canRefreshAgentPortfolio({ ...safe, pendingSaveCount: 1 }), false);
  assert.equal(canRefreshAgentPortfolio({ ...safe, editing: true }), false);
  assert.equal(canRefreshAgentPortfolio({ ...safe, current: [...current] }), false);
});

test("agent refresh detects newer server revisions and new assignments", () => {
  const current = [project("case-a", 3)];
  assert.equal(hasNewAgentCloudData(current, [project("case-a", 3)]), false);
  assert.equal(hasNewAgentCloudData(current, [project("case-a", 4)]), true);
  assert.equal(hasNewAgentCloudData(current, [project("case-a", 3), project("case-b", 1)]), true);
  assert.equal(hasNewAgentCloudData(current, []), true);
  assert.equal(hasNewAgentCloudData(current, [project("case-a", 2)]), false);
});

test("agent refresh does not downgrade a server response containing older data", () => {
  const current = [project("case-a", 4), project("case-b", 5)];
  const remote = [project("case-a", 6), project("case-b", 4)];
  assert.equal(hasNewAgentCloudData(current, remote), false);
});
