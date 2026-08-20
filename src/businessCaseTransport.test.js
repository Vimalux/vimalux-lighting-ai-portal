import test from "node:test";
import assert from "node:assert/strict";
import { projectFromBusinessCaseRow } from "./businessCaseTransport.js";

function baseRow() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    business_case_code: "BC-TEST0001",
    crm_opportunity_id: "22222222-2222-4222-8222-222222222222",
    customer_id: "",
    crm_fields: {
      customer: "Comune Test",
      municipality: "Comune Test",
      project: "Test",
      stage: "negotiation",
      probability: 75,
      lamps: 495,
    },
    source_payload: {},
    result_summary: {},
    sync_source: "intelligence",
    sync_version: 1,
    last_synced_at: "2026-08-20T00:00:00Z",
  };
}

test("saved Intelligence groups remain authoritative over stale CRM lamp count", () => {
  const row = baseRow();
  row.intelligence_data = {
    customer: { name: "Comune Test" },
    project: { name: "Test", businessCaseId: "BC-TEST0001" },
    groups: [
      {
        id: "g1",
        name: "Gruppo 1",
        quantity: 595,
        technology: "SAP",
        existingWattage: 100,
        proposedProductId: "led-40",
        smartAssigned: true,
        powerAidAssigned: true,
      },
    ],
  };

  const project = projectFromBusinessCaseRow(row);
  assert.equal(project.groups.reduce((sum, group) => sum + Number(group.quantity || 0), 0), 595);
});

test("CRM lamp count seeds a Business Case when no Intelligence state is stored", () => {
  const row = baseRow();
  row.intelligence_data = {};
  row.crm_fields.lamps = 495;

  const project = projectFromBusinessCaseRow(row);
  assert.equal(project.groups.reduce((sum, group) => sum + Number(group.quantity || 0), 0), 495);
});
