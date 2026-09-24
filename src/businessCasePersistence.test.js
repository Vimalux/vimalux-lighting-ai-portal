import test from "node:test";
import assert from "node:assert/strict";
import { hasMeaningfulProjectIdentity, persistIntelligenceProject } from "./businessCasePersistence.js";
import { defaultProject } from "./model.js";

const draftCaseId = "8cea15fe-8698-4158-aebd-df6ad68aca09";
const opportunityId = "9cea15fe-8698-4158-aebd-df6ad68aca09";

test("default manual project is not ready for CRM promotion", () => {
  const project = defaultProject();
  project.customer.name = "Hera Luce test";
  assert.equal(project.project.name, "Nuovo progetto");
  assert.equal(hasMeaningfulProjectIdentity(project), false);
});

test("manual project becomes ready for CRM promotion only after a real project name is entered", () => {
  const project = defaultProject();
  project.customer.name = "Hera Luce test";
  project.project.name = "Hera Luce Pilot";
  assert.equal(hasMeaningfulProjectIdentity(project), true);
});

test("placeholder manual project is persisted immediately as a cloud draft without CRM promotion", async () => {
  const project = defaultProject();
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "create_intelligence_draft") return { data: draftCaseId, error: null };
      if (name === "save_business_case_intelligence") return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };

  const persisted = await persistIntelligenceProject(client, project, { role: "admin", id: "admin" });
  assert.equal(persisted.caseId, draftCaseId);
  assert.equal(persisted.crmOpportunityId, "");
  assert.equal(calls.filter((call) => call.name === "create_intelligence_draft").length, 1);
  assert.equal(calls.filter((call) => call.name === "promote_intelligence_draft").length, 0);
  const creation = calls.find((call) => call.name === "create_intelligence_draft");
  assert.equal(creation.args.legacy_id, project.id);
  assert.ok(creation.args.project_payload);
});

test("meaningful manual project creates a durable draft, promotes it, and saves the same Business Case", async () => {
  const project = defaultProject();
  project.customer.name = "Comune di Poggibonsi";
  project.project.name = "Poggibonsi";
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "create_intelligence_draft") return { data: draftCaseId, error: null };
      if (name === "promote_intelligence_draft") return { data: opportunityId, error: null };
      if (name === "save_business_case_intelligence") return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };

  const persisted = await persistIntelligenceProject(client, project, { role: "admin", id: "admin" });
  assert.equal(persisted.caseId, draftCaseId);
  assert.equal(persisted.crmOpportunityId, opportunityId);
  assert.deepEqual(calls.map((call) => call.name), [
    "create_intelligence_draft",
    "promote_intelligence_draft",
    "save_business_case_intelligence",
  ]);
  const saved = calls.at(-1);
  assert.equal(saved.args.case_id, draftCaseId);
  assert.equal(saved.args.project_payload.crm.opportunityId, opportunityId);
});
