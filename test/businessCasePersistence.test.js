import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { persistIntelligenceProject } from "../src/businessCasePersistence.js";

const caseId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";

function backend() {
  const casesByLegacyId = new Map();
  const opportunitiesByCase = new Map();
  const saved = [];
  let draftCreations = 0;
  let opportunityCreations = 0;
  return {
    saved,
    get draftCreations() { return draftCreations; },
    get opportunityCreations() { return opportunityCreations; },
    client: {
      async rpc(name, args) {
        if (name === "create_intelligence_draft") {
          if (!casesByLegacyId.has(args.legacy_id)) {
            casesByLegacyId.set(args.legacy_id, caseId);
            draftCreations += 1;
          }
          return { data: casesByLegacyId.get(args.legacy_id), error: null };
        }
        if (name === "promote_intelligence_draft") {
          if (!opportunitiesByCase.has(args.case_id)) {
            opportunitiesByCase.set(args.case_id, opportunityId);
            opportunityCreations += 1;
          }
          return { data: opportunitiesByCase.get(args.case_id), error: null };
        }
        if (name === "save_business_case_intelligence") { saved.push(args); return { data: saved.length, error: null }; }
        throw new Error(`Unexpected RPC ${name}`);
      },
    },
  };
}

function intelligenceProject() {
  const project = defaultProject();
  project.id = "local-montalbano";
  project.customer.name = "Montalbano Jonico";
  project.project.name = "Montalbano Jonico relamping";
  project.updatedAt = "2026-08-28T10:00:00.000Z";
  return project;
}

test("new Intelligence project creates one durable draft, one CRM Opportunity and subsequent save updates it", async () => {
  const cloud = backend();
  const profile = { id: "33333333-3333-4333-8333-333333333333", role: "admin" };
  const project = intelligenceProject();
  const first = await persistIntelligenceProject(cloud.client, project, profile);
  const linked = {
    ...project,
    id: first.caseId,
    crm: {
      ...(project.crm || {}),
      businessCaseRecordId: first.caseId,
      opportunityId: first.crmOpportunityId,
      uniqueProjectId: first.crmOpportunityId,
    },
  };
  const second = await persistIntelligenceProject(cloud.client, linked, profile);
  assert.equal(first.caseId, caseId);
  assert.equal(first.crmOpportunityId, opportunityId);
  assert.equal(second.caseId, caseId);
  assert.equal(second.crmOpportunityId, opportunityId);
  assert.equal(cloud.draftCreations, 1);
  assert.equal(cloud.opportunityCreations, 1);
  assert.equal(cloud.saved.length, 2);
  assert.ok(cloud.saved.every((entry) => entry.case_id === caseId));
  assert.ok(cloud.saved.every((entry) => entry.project_payload.crm.opportunityId === opportunityId));
});

test("linked project save never calls draft or CRM creation again", async () => {
  const cloud = backend();
  const project = intelligenceProject();
  project.id = caseId;
  project.crm.businessCaseRecordId = caseId;
  project.crm.opportunityId = opportunityId;
  project.crm.uniqueProjectId = opportunityId;
  await persistIntelligenceProject(cloud.client, project, { id: "admin", role: "admin" });
  assert.equal(cloud.draftCreations, 0);
  assert.equal(cloud.opportunityCreations, 0);
  assert.equal(cloud.saved.length, 1);
});
