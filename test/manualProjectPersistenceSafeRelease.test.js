import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("manual project persistence never depends on complete identity before cloud draft creation", () => {
  const source = fs.readFileSync(new URL("../src/businessCasePersistence.js", import.meta.url), "utf8");
  assert.match(source, /client\.rpc\("create_intelligence_draft"/);
  assert.match(source, /hasMeaningfulProjectIdentity\(project\)/);
  assert.match(source, /client\.rpc\("promote_intelligence_draft"/);
  assert.doesNotMatch(source, /if \(!hasMeaningfulProjectIdentity\(project\)\) return null/);
  assert.doesNotMatch(source, /client\.rpc\("create_internal_business_case"/);
});

test("cloud load carries unsynced manual drafts and cloud save prioritizes unstable IDs", () => {
  const source = fs.readFileSync(new URL("../src/supabase.js", import.meta.url), "utf8");
  assert.match(source, /const pendingLocalProjects = \(localProjects \|\| \[\]\)\.filter/);
  assert.doesNotMatch(source, /\(item\?\.importedTechnical \|\| item\?\.importedCommercial\) &&/);
  assert.match(source, /const saveOrder = \[\.\.\.uniqueProjects\]\.sort/);
  assert.match(source, /Number\(isStableCloudId\(a\?\.id\)\) - Number\(isStableCloudId\(b\?\.id\)\)/);
});
