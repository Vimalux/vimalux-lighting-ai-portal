import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_VIEWS, navigationKey, readNavigation, writeNavigation, findLinkedProject } from "../src/navigationState.js";
const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) }; };

test("an absent opportunity parameter never selects a different project with null CRM fields", () => {
  const first = { id: "first", crm: { opportunityId: null, uniqueProjectId: null } };
  const target = { id: "target", project: { businessCaseId: "BC-P" }, crm: { businessCaseRecordId: "uuid", opportunityId: "opp" } };
  const projects = [first, target];
  for (const ref of ["target", "uuid", "BC-P"]) assert.equal(findLinkedProject(projects, ref, null), target);
  assert.equal(findLinkedProject(projects, null, "opp"), target);
  assert.equal(findLinkedProject(projects, null, null), undefined);
  assert.equal(findLinkedProject(projects, "missing", null), undefined);
});

test("saved navigation survives a new read and is isolated by account and project", () => {
  const store = storage();
  const key = navigationKey("admin", "case-a");
  writeNavigation(store, key, "catalogue", ADMIN_VIEWS);
  assert.equal(readNavigation(store, key, ADMIN_VIEWS), "catalogue");
  assert.equal(readNavigation(store, navigationKey("agent", "case-a"), ADMIN_VIEWS), "customer");
  assert.equal(readNavigation(store, navigationKey("admin", "case-b"), ADMIN_VIEWS), "customer");
});

test("agent permissions filter stale admin navigation without exposing it", () => {
  const store = storage(), key = navigationKey("user", "case");
  const allowed = new Set(["customer", "solution", "assumptions", "report", "projects"]);
  writeNavigation(store, key, "orderList", ADMIN_VIEWS);
  assert.equal(readNavigation(store, key, allowed), "customer");
  writeNavigation(store, key, "solution", allowed);
  writeNavigation(store, key, "admin", allowed);
  assert.equal(readNavigation(store, key, allowed), "solution");
});

test("invalid or unavailable storage cannot break navigation", () => {
  const broken = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.equal(readNavigation(broken, "key", ADMIN_VIEWS), "customer");
  assert.doesNotThrow(() => writeNavigation(broken, "key", "report", ADMIN_VIEWS));
  assert.equal(readNavigation({getItem:()=>"unknown"}, "key", ADMIN_VIEWS), "customer");
});
