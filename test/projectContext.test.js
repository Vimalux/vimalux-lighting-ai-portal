import test from "node:test";
import assert from "node:assert/strict";
import {
  accountKey, PROJECTS_KEY, CACHE_OWNER_KEY, initialProjectId, reconcileHydration,
  createRequestRevision, migrateProjectNavigation, readAccountProjects, writeProjectRoute,
} from "../src/projectContext.js";
import { findLinkedProject, navigationKey, writeNavigation, readNavigation, ADMIN_VIEWS } from "../src/navigationState.js";
const feletto = { id: "feletto", crm: { opportunityId: "old-opp" } };
const san = { id: "san-fele", crm: {} };
const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; };

test("explicit San Fele takes precedence over old Feletto opportunity; unresolved routes never select first project", () => {
  assert.equal(findLinkedProject([feletto, san], san.id, "old-opp"), san);
  assert.equal(initialProjectId([feletto, san], "?business_case_id=missing"), "");
  assert.equal(initialProjectId([feletto, san], "", san.id), san.id);
  assert.equal(initialProjectId([feletto, san], ""), feletto.id);
  const promoted = { ...san, id: "cloud-san", crm: { legacyIntelligenceId: san.id } };
  assert.equal(initialProjectId([feletto, promoted], "?business_case_id=san-fele"), "cloud-san");
});
test("a late cloud response preserves a new draft and in-flight edits but does not resurrect unchanged deleted rows", () => {
  const old = { id: "old" }, before = [feletto, old];
  const edited = { ...feletto, name: "Changed" };
  assert.deepEqual(reconcileHydration([edited, old, san], [feletto], before), [edited, san]);
});
test("a project selection invalidates old asynchronous activation", async () => {
  const requests = createRequestRevision();
  let resolve, active = feletto.id;
  const request = new Promise((r) => { resolve = r; });
  const revision = requests.next();
  const finish = request.then((project) => { if (requests.accepts(revision)) active = project.id; });
  requests.next(); active = san.id;
  resolve(feletto); await finish;
  assert.equal(active, san.id);
});
test("cloud promotion retains Existing Lighting without disturbing other projects or accounts", () => {
  const store = storage();
  writeNavigation(store, navigationKey("user", san.id), "existing", ADMIN_VIEWS);
  migrateProjectNavigation(store, "user", san.id, "cloud-san", ADMIN_VIEWS);
  assert.equal(readNavigation(store, navigationKey("user", "cloud-san"), ADMIN_VIEWS), "existing");
  assert.equal(readNavigation(store, navigationKey("other", "cloud-san"), ADMIN_VIEWS), "customer");
  assert.equal(readNavigation(store, navigationKey("user", feletto.id), ADMIN_VIEWS), "customer");
});
test("account cache migration retains legacy drafts but never consumes a different account cache", () => {
  const store = storage();
  assert.deepEqual(readAccountProjects(store, "a", [san]), [san]);
  store.setItem(CACHE_OWNER_KEY, "a");
  assert.deepEqual(readAccountProjects(store, "b", [san]), []);
  store.setItem(accountKey(PROJECTS_KEY, "b"), JSON.stringify([feletto]));
  assert.deepEqual(readAccountProjects(store, "b", [san]), [feletto]);
});
test("project navigation preserves unrelated query/hash, clears old opportunity, and records history", () => {
  const calls = [];
  const browser = {
    location: new URL("https://preview.example/?opportunity_id=old-opp&keep=1#section"),
    history: { pushState: (...args) => calls.push(args) },
  };
  const search = writeProjectRoute(browser, san, "existing", false);
  assert.equal(new URLSearchParams(search).get("business_case_id"), san.id);
  assert.equal(new URLSearchParams(search).get("opportunity_id"), null);
  assert.equal(calls.length, 1);
  assert.match(calls[0][2], /keep=1/);
  assert.match(calls[0][2], /#section$/);
});
