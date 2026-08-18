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
  const project = projectFromBusinessCaseRow({
    id: caseId,
    business_case_code: "BC-STABLE",
    crm_opportunity_id: "e20f1f9f-ab61-44de-a990-424804161854",
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
  assert.equal(project.crm.closingProbability, 55);
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
