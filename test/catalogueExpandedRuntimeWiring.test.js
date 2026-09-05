import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("catalogue detail continuity runtime is wired without data mutations", () => {
  const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../src/catalogueExpandedStateRuntime.js", import.meta.url), "utf8");
  assert.match(main, /catalogueExpandedStateRuntime\.js/);
  assert.match(runtime, /sessionStorage/);
  assert.doesNotMatch(runtime, /supabase|saveCloudState|setProjects|catalogue\s*=/i);
});
