import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  new URL("../.github/workflows/staging-validation.yml", import.meta.url),
  "utf8",
);

test("SAFE RELEASE: every pull request to main is validated", () => {
  assert.match(workflow, /pull_request:\s*\n\s*branches:\s*\n\s*- main/);
});

test("SAFE RELEASE: all staging branches and main pushes are validated", () => {
  assert.match(workflow, /- main/);
  assert.match(workflow, /- ["']staging\/\*\*["']/);
});

test("SAFE RELEASE: validation runs regression tests, production build and served-app smoke test", () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /vite preview/);
  assert.match(workflow, /curl --fail/);
  assert.match(workflow, /git diff --exit-code HEAD/);
});

test("SAFE RELEASE: validation workflow remains read-only", () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});
