import test from "node:test";
import assert from "node:assert/strict";
import { reconcileReimportIdentity } from "../src/model.js";

const existing = {
  id: "e9526284-4811-4d49-944a-68d68c7d521b",
  createdAt: "2026-08-21",
  updatedAt: "2026-08-21T10:00:00.000Z",
  name: "P. test",
  customer: { name: "Comune di Test" },
  project: { name: "P. test", businessCaseId: "BC-714620" },
  crm: {
    opportunityId: "11111111-2222-4333-8444-555555555555",
    uniqueProjectId: "11111111-2222-4333-8444-555555555555",
    businessCaseRecordId: "e9526284-4811-4d49-944a-68d68c7d521b",
    status: "proposal",
    closingProbability: 60,
  },
  assumptions: { energyPrice: 0.29 },
  additionalCosts: [{ id: "cost-1", description: "Pali", unitCost: 50 }],
  pricing: { overrides: { "led-40": 123 } },
  catalogue: { led: [{ id: "led-40", wattage: 40 }], smart: [] },
  groups: [{ id: "old", name: "SAP 150 W", quantity: 35, technology: "SAP", existingWattage: 150 }],
};

const incoming = {
  id: "newlocal1",
  createdAt: "2026-08-22",
  updatedAt: "2026-08-22T08:00:00.000Z",
  name: "P. test",
  customer: { name: "" },
  project: { name: "P. test", businessCaseId: "BC-999999" },
  crm: { opportunityId: "", uniqueProjectId: "", status: "lead", closingProbability: 25 },
  groups: [{ id: "new", name: "SAP 150 W", quantity: 36, technology: "SAP", existingWattage: 150 }],
  importedTechnical: { type: "lighting", fileName: "test.xlsx", importedAt: "2026-08-22T08:00:00.000Z" },
};

test("technical reimport reuses Business Case and CRM identity", () => {
  const result = reconcileReimportIdentity(incoming, [existing]);
  assert.equal(result.id, existing.id);
  assert.equal(result.project.businessCaseId, "BC-714620");
  assert.equal(result.crm.opportunityId, existing.crm.opportunityId);
  assert.equal(result.crm.businessCaseRecordId, existing.id);
  assert.equal(result.crm.status, "proposal");
  assert.equal(result.groups[0].quantity, 36);
  assert.equal(result.assumptions.energyPrice, 0.29);
  assert.equal(result.additionalCosts[0].unitCost, 50);
  assert.equal(result.pricing.overrides["led-40"], 123);
  assert.equal(result.customer.name, "Comune di Test");
});

test("different project name remains a new project", () => {
  const result = reconcileReimportIdentity({ ...incoming, project: { ...incoming.project, name: "P. test fase 2" }, name: "P. test fase 2" }, [existing]);
  assert.equal(result.id, "newlocal1");
  assert.equal(result.crm.opportunityId, "");
});
