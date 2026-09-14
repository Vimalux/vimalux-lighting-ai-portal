import test from "node:test";
import assert from "node:assert/strict";
import { hasMeaningfulProjectIdentity, persistIntelligenceProject } from "./businessCasePersistence.js";
import { defaultProject } from "./model.js";

test("default manual project is not ready for cloud/CRM creation", () => {
  const project = defaultProject();
  project.customer.name = "Hera Luce test";
  assert.equal(project.project.name, "Nuovo progetto");
  assert.equal(hasMeaningfulProjectIdentity(project), false);
});

test("manual project becomes ready only after a real project name is entered", () => {
  const project = defaultProject();
  project.customer.name = "Hera Luce test";
  project.project.name = "Hera Luce Pilot";
  assert.equal(hasMeaningfulProjectIdentity(project), true);
});

test("manual project creation always sends legacy_id and project_payload", async () => {
  const project = defaultProject();
  project.customer.name = "Hera Luce test";
  project.project.name = "Hera Luce Pilot";
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "create_internal_business_case") return { data: "8cea15fe-8698-4158-aebd-df6ad68aca09", error: null };
      if (name === "promote_intelligence_draft") return { data: "9cea15fe-8698-4158-aebd-df6ad68aca09", error: null };
      if (name === "save_business_case_intelligence") return { data: true, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };

  await persistIntelligenceProject(client, project, { role: "admin", id: "admin" });
  const creation = calls.find((call) => call.name === "create_internal_business_case");
  assert.ok(creation);
  assert.equal(creation.args.legacy_id, project.id);
  assert.ok(creation.args.project_payload);
});
