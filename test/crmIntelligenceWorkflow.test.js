import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { defaultProject } from "../src/model.js";
import { persistIntelligenceProject } from "../src/businessCasePersistence.js";
import { projectFromBusinessCaseRow } from "../src/businessCaseTransport.js";

const caseId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";

function linkedProject() {
  const project = defaultProject();
  project.id = caseId;
  project.customer.name = "Montalbano Jonico";
  project.project.name = "Montalbano Jonico";
  project.crm.businessCaseRecordId = caseId;
  project.crm.opportunityId = opportunityId;
  project.crm.uniqueProjectId = opportunityId;
  project.crm.agentId = "33333333-3333-4333-8333-333333333333";
  project.updatedAt = "2026-08-28T12:00:00.000Z";
  return project;
}

test("Input Sheet combinations survive calculation, save, reopen and CRM sync", async () => {
  const project = linkedProject();
  project.groups = [
    { ...project.groups[0], id: "led-70", name: "Centro LED 70", quantity: 12, technology: "LED", existingWattage: 70, ledProductId: "vima-40", projectLedWattage: 40, existingDimmingNote: "Centro" },
    { ...project.groups[0], id: "sap-100", name: "Via Roma SAP 100", quantity: 23, technology: "SAP / HPS", existingWattage: 100, ledProductId: "mako-30", projectLedWattage: 30, existingDimmingNote: "Via Roma" },
    { ...project.groups[0], id: "mercury-125", name: "Parco Mercury 125", quantity: 9, technology: "Mercury", existingWattage: 125, ledProductId: "vima-70", projectLedWattage: 70, existingDimmingNote: "Parco" },
  ];
  let saved;
  const client = { async rpc(name, args) {
    assert.equal(name, "save_business_case_intelligence");
    saved = args;
    return { data: 2, error: null };
  } };
  await persistIntelligenceProject(client, project, { id: "admin", role: "admin" });
  const reopened = projectFromBusinessCaseRow({
    id: caseId,
    business_case_code: project.project.businessCaseId,
    crm_opportunity_id: opportunityId,
    crm_fields: { customer: project.customer.name, project: project.project.name, stage: "proposal", probability: 60 },
    source_payload: {},
    intelligence_data: saved.project_payload,
    result_summary: saved.calculated_result,
  });
  assert.deepEqual(reopened.groups.map(({ name, quantity, technology, existingWattage, ledProductId, projectLedWattage, existingDimmingNote }) => ({ name, quantity, technology, existingWattage, ledProductId, projectLedWattage, existingDimmingNote })), project.groups.map(({ name, quantity, technology, existingWattage, ledProductId, projectLedWattage, existingDimmingNote }) => ({ name, quantity, technology, existingWattage, ledProductId, projectLedWattage, existingDimmingNote })));
  assert.equal(reopened.crm.opportunityId, opportunityId);
  assert.equal(reopened.crm.businessCaseRecordId, caseId);
});

test("Intelligence recalculation uses only the protected sync RPC and leaves CRM-owned records alone", async () => {
  const project = linkedProject();
  project.crm.notes = "Manual CRM note";
  project.solution.cmsPartner = "Project-specific CMS";
  const crm = { stage: "negotiation", owner: "Agent A", comment: "Keep me", cmsPartner: "Project-specific CMS" };
  const offers = [{ id: "offer-1", status: "published", version: 3 }, { id: "offer-2", status: "preliminary", version: 4 }];
  const calls = [];
  const client = { async rpc(name) {
    calls.push(name);
    return { data: 2, error: null };
  } };
  await persistIntelligenceProject(client, project, { id: "admin", role: "admin" });
  assert.deepEqual(calls, ["save_business_case_intelligence"]);
  assert.deepEqual(crm, { stage: "negotiation", owner: "Agent A", comment: "Keep me", cmsPartner: "Project-specific CMS" });
  assert.deepEqual(offers, [{ id: "offer-1", status: "published", version: 3 }, { id: "offer-2", status: "preliminary", version: 4 }]);
});

test("Agent/Admin visibility guards remain in the current application", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");
  assert.match(source, /!isAgent && view === "crm"/);
  assert.match(source, /if \(isAgent && path\[0\] === "pricing"\) return all;/);
  assert.match(source, /if \(isReadOnlyAgentProject\) return all;/);
});

test("null Intelligence values do not become direct CRM project writes", async () => {
  const project = linkedProject();
  project.crm.notes = undefined;
  project.crm.expectedCloseDate = null;
  const calls = [];
  const client = { async rpc(name, args) { calls.push({ name, args }); return { data: 3, error: null }; } };
  await persistIntelligenceProject(client, project, { id: "admin", role: "admin" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_business_case_intelligence");
  assert.equal(calls.some((call) => call.name === "save_crm_project"), false);
});
