import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("catalogue expanded runtime stores UI ids only", () => {
  const source = fs.readFileSync(new URL("../src/catalogueExpandedStateRuntime.js", import.meta.url), "utf8");
  assert.match(source, /sessionStorage/);
  assert.doesNotMatch(source, /supabase|saveCloudState|catalogue\s*=/i);
});
