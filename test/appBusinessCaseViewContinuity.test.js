import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("Supabase profile hydration does not force an allowed Business Case view to customer", () => {
  assert.doesNotMatch(source, /if \(profile\?\.role === "agent"\) setView\("customer"\)/);
  assert.match(source, /if \(isAgent && !isAgentViewAllowed\(view, agentAllowedViews\)\) setView\("customer"\)/);
});

test("same active Business Case keeps its workflow view when URL match rehydrates", () => {
  assert.match(source, /sameBusinessCaseIdentity\(project, activeId, match, businessCaseId\)/);
  assert.match(source, /workflow\.some\(\(\[id\]\) => id === view\)/);
});

test("same active Business Case keeps its workflow view when loaded from Supabase", () => {
  assert.match(source, /sameBusinessCaseIdentity\(project, activeId, migrated, businessCaseId\)/);
  const conditionalResets = source.match(/if \(!preserveCurrentView\) setView\("customer"\)/g) || [];
  assert.equal(conditionalResets.length, 2);
});

test("Business Case identity accepts record UUID and human-readable BC code aliases", () => {
  assert.match(source, /item\?\.crm\?\.businessCaseRecordId/);
  assert.match(source, /item\?\.project\?\.businessCaseId/);
  assert.match(source, /normalizeId\(requestedId\)/);
});
