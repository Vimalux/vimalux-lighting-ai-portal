import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("CRM and Intelligence share one audited Supabase session", () => {
  const runtime = fs.readFileSync("src/platformActivityRuntime.js", "utf8");
  const main = fs.readFileSync("src/main.jsx", "utf8");
  assert.match(main, /platformActivityRuntime\.js/);
  assert.match(runtime, /project_activity/);
  assert.match(runtime, /"login"/);
  assert.match(runtime, /"logout"/);
  assert.match(runtime, /"module_opened"/);
  assert.match(runtime, /moduleFromTitle/);
  assert.match(runtime, /vimalux_unified_app/);
});

test("module classifier separates CRM from Intelligence", async () => {
  const source = fs.readFileSync("src/platformActivityRuntime.js", "utf8");
  assert.match(source, /includes\("CRM"\) \? "crm" : "intelligence"/);
});
