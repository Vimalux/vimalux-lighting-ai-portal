import test from "node:test";
import assert from "node:assert/strict";
import { catalogueExpandedStateKey } from "../src/catalogueExpandedState.js";

test("catalogue expanded state is scoped to the Business Case", () => {
  assert.equal(catalogueExpandedStateKey({ id: "local-1" }), "vimalux:catalogue-expanded:local-1");
  assert.equal(catalogueExpandedStateKey({ id: "x", crm: { businessCaseRecordId: "bc-123" } }), "vimalux:catalogue-expanded:bc-123");
});
