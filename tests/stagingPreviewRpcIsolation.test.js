import test from "node:test";
import assert from "node:assert/strict";
import { stagingPreviewRpcResponse } from "../src/stagingPreviewRpcIsolation.js";
import { proposalProjectWithCatalogue } from "../src/proposalContext.js";

test("preview proposal catalogue RPC does not call restricted staging database", () => {
  const response = stagingPreviewRpcResponse("get_intelligence_catalogue");
  assert.equal(response.error, null);
  assert.equal(response.data, null);
  assert.equal(response.status, 200);

  const project = { catalogue: { led: [{ id: "led-1" }], smart: [{ id: "smart-1" }] } };
  assert.equal(proposalProjectWithCatalogue({ intelligence_data: project }, response.data), project);
});

test("preview proposal history and publish calls remain local", () => {
  assert.deepEqual(stagingPreviewRpcResponse("get_proposal_history").data, []);
  assert.deepEqual(stagingPreviewRpcResponse("publish_intelligence_preliminary_proposal").data, { preview: true });
  assert.equal(stagingPreviewRpcResponse("other_rpc"), null);
});

test("preview Business Case listing preserves the provided project snapshots", () => {
  const rows = [{ id: "local-1", intelligence_data: { language: "es" } }];
  assert.equal(stagingPreviewRpcResponse("list_business_cases_v2", rows).data, rows);
  assert.deepEqual(stagingPreviewRpcResponse("list_archived_business_cases_v2").data, []);
});
