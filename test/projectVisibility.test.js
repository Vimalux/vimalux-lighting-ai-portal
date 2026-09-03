import test from "node:test";
import assert from "node:assert/strict";
import { activeIntelligenceProjects, isArchivedProject } from "../src/projectVisibility.js";

test("archived CRM-linked Business Cases are hidden from active Intelligence", () => {
  const active = { id: "active", crm: { status: "lead" } };
  const archived = { id: "archived", crm: { status: "archived" } };
  const legacyArchived = { id: "legacy", crm: { status: "proposal", archivedAt: "2026-09-03T10:00:00Z" } };

  assert.equal(isArchivedProject(active), false);
  assert.equal(isArchivedProject(archived), true);
  assert.equal(isArchivedProject(legacyArchived), true);
  assert.deepEqual(activeIntelligenceProjects([active, archived, legacyArchived]).map((item) => item.id), ["active"]);
});
