import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  businessCaseOpenUrl,
  isStableBusinessCaseLink,
  projectFromBusinessCaseRow,
} from "../src/businessCaseTransport.js";

const caseId = "5a749b5c-45ad-4ca0-8eb0-9d546a2f8897";

test("stable CRM identity overrides conflicting Intelligence identity", () => {
  const opportunityId = "e20f1f9f-ab61-44de-a990-424804161854";
  const project = projectFromBusinessCaseRow({
    id: caseId,
    business_case_code: "BC-STABLE",
    crm_opportunity_id: opportunityId,
    customer_id: "CUSTOMER-1",
    crm_fields: {
      customer: "Comune autorevole",
      project: "Relamping autorevole",
      stage: "proposal",
      probability: 55,
    },
    source_payload: {},
    intelligence_data: {
      customer: { name: "Querystring customer" },
      project: { name: "Querystring project" },
    },
    result_summary: {},
  });
  assert.equal(project.customer.name, "Comune autorevole");
  assert.equal(project.project.name, "Relamping autorevole");
  assert.equal(project.project.businessCaseId, "BC-STABLE");
  assert.equal(project.crm.businessCaseRecordId, caseId);
  assert.equal(project.crm.opportunityId, opportunityId);
  assert.equal(project.crm.uniqueProjectId, opportunityId);
  assert.equal(project.crm.closingProbability, 55);
});

test("unlinked Business Case never uses its record id or stale payload as CRM opportunity id", () => {
  const staleOpportunityId = "25b37e02-bc50-48e3-a95b-8f4f7254c282";
  const project = projectFromBusinessCaseRow({
    id: caseId,
    business_case_code: "BC-UNLINKED",
    crm_opportunity_id: null,
    crm_fields: {
      customer: "LAJATICO",
      project: "LAJATICO",
      stage: "lead",
      probability: 0,
      crm_opportunity_id: staleOpportunityId,
    },
    source_payload: {},
    intelligence_data: {
      customer: { name: "LAJATICO" },
      project: { name: "LAJATICO" },
      crm: {
        opportunityId: staleOpportunityId,
        uniqueProjectId: staleOpportunityId,
        status: "lead",
      },
    },
    result_summary: {},
  });

  assert.equal(project.id, caseId);
  assert.equal(project.crm.businessCaseRecordId, caseId);
  assert.equal(project.crm.opportunityId, "");
  assert.equal(project.crm.uniqueProjectId, "");
});

test("VML source groups preserve global fixed dimming", () => {
  const project = projectFromBusinessCaseRow({
    id: caseId,
    business_case_code: "BC-DIM",
    crm_fields: { customer: "C", project: "P" },
    source_payload: {
      groups: [{ group: "SAP 100", technology: "SAP", quantity: 10, nominalWatt: 100, annualHours: 4200 }],
      existingInstallation: { dimmingPct: 20, energyPrice: 0.29 },
    },
    intelligence_data: {},
    result_summary: {},
  });
  assert.equal(project.groups[0].existingDimmingProfile, "fixed");
  assert.equal(project.groups[0].existingDimmingPercent, 20);
  assert.equal(project.groups[0].existingSystemFactor, 1.2);
});

test("stable URL never transports authoritative source fields", () => {
  assert.equal(
    businessCaseOpenUrl(caseId),
    "https://app.vimalux.com/?business_case_id=" + caseId,
  );
  assert.equal(isStableBusinessCaseLink("?business_case_id=" + caseId), true);
  assert.equal(isStableBusinessCaseLink("?business_case_id=BC-123&customer=X"), false);
});

test("production rejects legacy querystring payloads as authoritative", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "App.jsx"),
    "utf8",
  );
  const stableLoad = source.indexOf("loadBusinessCase(businessCaseId)");
  const productionGuard = source.indexOf("if (supabaseConfigured)", stableLoad);
  const legacyImport = source.indexOf("opportunityFromSearchParams(params)", productionGuard);
  assert.ok(stableLoad > 0);
  assert.ok(productionGuard > stableLoad);
  assert.ok(legacyImport > productionGuard);
});
