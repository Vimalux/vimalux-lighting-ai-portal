import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canonicalBusinessCaseRef,
  isAuthoritativeBusinessCaseView,
} from "../src/businessCaseViewAuthorityRuntime.js";

test("Business Case code and UUID resolve to the same canonical record id", () => {
  const projects = [{
    id: "legacy-local-id",
    project: { businessCaseId: "BC-SALUZZO-001" },
    crm: { businessCaseRecordId: "11111111-2222-3333-4444-555555555555" },
  }];
  const expected = "11111111-2222-3333-4444-555555555555";
  assert.equal(canonicalBusinessCaseRef("BC-SALUZZO-001", projects, ""), expected);
  assert.equal(canonicalBusinessCaseRef(expected, projects, ""), expected);
});

test("remembered stable Business Case id is used when the URL has no explicit case", () => {
  assert.equal(
    canonicalBusinessCaseRef("", [], "11111111-2222-3333-4444-555555555555"),
    "11111111-2222-3333-4444-555555555555",
  );
});

test("only Business Case workflow views can become authoritative", () => {
  for (const view of ["customer", "existing", "solution", "additionalCosts", "pricing", "assumptions", "business", "report"]) {
    assert.equal(isAuthoritativeBusinessCaseView(view), true);
  }
  for (const view of ["crm", "datek", "partnerReports", "projects", "catalogue", "admin"]) {
    assert.equal(isAuthoritativeBusinessCaseView(view), false);
  }
});

test("authority guard handles late customer drift and disarms on project/global navigation", () => {
  const source = fs.readFileSync(
    new URL("../src/businessCaseViewAuthorityRuntime.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /active\.view && active\.view !== "customer"/);
  assert.match(source, /const projectSelect = event\.target\?\.closest\?\.\("\.project-select"\)/);
  assert.match(source, /if \(projectSelect\) \{[\s\S]*disarmAuthority\(\)/);
  assert.match(source, /if \(PROJECT_VIEW_LABELS\.has\(norm\(nav\.textContent\)\)\) \{[\s\S]*rememberManualProjectView\(nav\)[\s\S]*\} else \{[\s\S]*disarmAuthority\(\)/);
  assert.match(source, /if \(authoritative\) queueMicrotask\(healAuthoritativeView\)/);
});
