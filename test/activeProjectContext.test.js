import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("active project header uses URL business_case_id as canonical source", () => {
  const source = fs.readFileSync(
    new URL("../src/activeProjectContextRuntime.js", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const urlBusinessCaseId = String\(currentParams\(\)\.get\("business_case_id"\)/,
  );
  assert.match(
    source,
    /const businessCaseId = urlBusinessCaseId \|\| renderedMatch\?\.\[0\] \|\| ""/,
  );
  assert.doesNotMatch(source, /small\.dataset\.businessCaseId/);
});
