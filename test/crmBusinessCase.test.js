import test from "node:test";
import assert from "node:assert/strict";
import {
  businessCaseActionLabel,
  createOrGetBusinessCaseForOpportunity,
  linkedBusinessCaseUrl,
  lookupBusinessCaseForOpportunity,
} from "../src/crmBusinessCase.js";

const opportunityId = "22222222-2222-4222-8222-222222222222";
const caseId = "11111111-1111-4111-8111-111111111111";

function linkedBackend(initialCaseId = "") {
  let storedCaseId = initialCaseId;
  let creations = 0;
  const calls = [];
  return {
    calls,
    get creations() { return creations; },
    client: {
      async rpc(name, args) {
        calls.push([name, args]);
        if (name === "get_business_case_id_for_opportunity") return { data: storedCaseId || null, error: null };
        if (name === "create_or_get_business_case") {
          if (!storedCaseId) { storedCaseId = caseId; creations += 1; }
          return { data: storedCaseId, error: null };
        }
        throw new Error(`Unexpected RPC ${name}`);
      },
    },
  };
}

test("CRM Opportunity creates exactly one linked Intelligence Business Case", async () => {
  const backend = linkedBackend();
  assert.equal(await lookupBusinessCaseForOpportunity(backend.client, opportunityId), "");
  assert.equal(await createOrGetBusinessCaseForOpportunity(backend.client, opportunityId), caseId);
  assert.equal(await lookupBusinessCaseForOpportunity(backend.client, opportunityId), caseId);
  assert.equal(backend.creations, 1);
});

test("already linked Opportunity reopens the existing Business Case", async () => {
  const backend = linkedBackend(caseId);
  assert.equal(await lookupBusinessCaseForOpportunity(backend.client, opportunityId), caseId);
  assert.equal(await createOrGetBusinessCaseForOpportunity(backend.client, opportunityId), caseId);
  assert.equal(backend.creations, 0);
});

test("double click and request retry remain idempotent", async () => {
  const backend = linkedBackend();
  const ids = await Promise.all([
    createOrGetBusinessCaseForOpportunity(backend.client, opportunityId),
    createOrGetBusinessCaseForOpportunity(backend.client, opportunityId),
  ]);
  assert.deepEqual(ids, [caseId, caseId]);
  assert.equal(backend.creations, 1);
});

test("CRM action uses the authoritative stable Business Case link", () => {
  assert.equal(linkedBusinessCaseUrl(caseId, "https://app.vimalux.com"), `https://app.vimalux.com/?business_case_id=${caseId}`);
  assert.equal(businessCaseActionLabel(false, "da"), "Opret Business Case i Intelligence");
  assert.equal(businessCaseActionLabel(true, "it"), "Apri Business Case");
});

test("invalid identities fail before any server mutation", async () => {
  const backend = linkedBackend();
  await assert.rejects(createOrGetBusinessCaseForOpportunity(backend.client, "Montalbano Jonico"), /CRM Opportunity ID/);
  assert.equal(backend.calls.length, 0);
});
