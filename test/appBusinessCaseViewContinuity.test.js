import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("Supabase profile hydration does not force an allowed Business Case view to customer", () => {
  assert.doesNotMatch(source, /if \(profile\?\.role === "agent"\) setView\("customer"\)/);
  assert.match(source, /if \(isAgent && !isAgentViewAllowed\(view, agentAllowedViews\)\) setView\("customer"\)/);
});

test("same active Business Case keeps its workflow view when URL match rehydrates", () => {
  const matchBranch = source.slice(source.indexOf("if (match) {"), source.indexOf("if (isStableBusinessCaseLink(params)"));
  assert.match(matchBranch, /setActiveId\(match.id\)/);
  assert.doesNotMatch(matchBranch, /setView/);
});

test("same active Business Case keeps its workflow view when loaded from Supabase", () => {
  const loadBranch = source.slice(source.indexOf("loadBusinessCase(businessCaseId)"), source.indexOf("This legacy CRM link"));
  assert.match(loadBranch, /setActiveId\(migrated.id\)/);
  assert.doesNotMatch(loadBranch, /setView/);
});

test("persisted menu is scoped to the verified account and active Business Case", () => {
  assert.match(source, /usePersistentNavigation\(/);
  assert.match(source, /session && cloudReady && roleVerified/);
  assert.match(source, /userId: session\?\.user\?\.id/);
  assert.match(source, /projectId: project.crm\?\.businessCaseRecordId \|\| project.id/);
});
