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
  assert.ok(creation.args.project_payload.internalFinancial);
  assert.equal(typeof creation.args.project_payload.internalFinancial.total_direct_costs, "number");
  assert.equal(Object.hasOwn(creation.args.project_payload.internalFinancial, "bonus"), false);
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
  assert.ok(saved.args.project_payload.internalFinancial);
  assert.equal(saved.args.project_payload.internalFinancial.source, "VIMALUX Intelligence calculation engine");
});


test("stale post-promotion project reuses immutable legacy identity instead of creating a duplicate", async () => {
  const project = defaultProject();
  project.id = "BC-473640";
  project.customer.name = "Comune di Vicopisano";
  project.project.name = "Vicopisano";
  project.project.businessCaseId = "BC-473640";
  project.crm.legacyIntelligenceId = "q23sv30y";

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

  await persistIntelligenceProject(client, project, { role: "admin", id: "admin" });

  const creation = calls.find((call) => call.name === "create_intelligence_draft");
  assert.equal(creation.args.legacy_id, "q23sv30y");
  assert.notEqual(creation.args.legacy_id, project.id);
});


test("assigned agent can save a promoted cloud case even before local agentId is hydrated", async () => {
  const project = defaultProject();
  project.id = draftCaseId;
  project.crm.businessCaseRecordId = draftCaseId;
  project.crm.agentId = "";
  project.crm.agentAccessMode = "owner";
  project.customer.name = "Comune di Verzuolo";
  project.project.name = "Verzuolo";
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "promote_intelligence_draft") return { data: opportunityId, error: null };
      if (name === "save_business_case_intelligence") return { data: 12, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };

  const persisted = await persistIntelligenceProject(client, project, { role: "agent", id: "agent-1" });
  assert.ok(persisted);
  assert.equal(calls.some((call) => call.name === "save_business_case_intelligence"), true);
});

test("read-only agent project is never persisted by the browser", async () => {
  const project = defaultProject();
  project.id = draftCaseId;
  project.crm.businessCaseRecordId = draftCaseId;
  project.crm.agentAccessMode = "read_only";
  const client = { rpc: async () => { throw new Error("RPC must not be called"); } };
  const persisted = await persistIntelligenceProject(client, project, { role: "agent", id: "agent-2" });
  assert.equal(persisted, null);
});
