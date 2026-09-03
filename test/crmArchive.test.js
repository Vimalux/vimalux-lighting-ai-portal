import test from "node:test";
import assert from "node:assert/strict";
import {
  activePipelineProjects,
  isArchivedOpportunity,
  pipelineStageTotals,
  pipelineTotals,
  probabilityWeightedForecast,
} from "../src/crm.js";

const project = (id, status, tcv, probability, archivedAt = "") => ({
  id,
  crm: {
    status,
    totalContractValue: tcv,
    closingProbability: probability,
    archivedAt,
    businessCase: { arr: tcv / 10 },
  },
  assumptions: { serviceAgreementPeriod: 10 },
});

test("archived CRM opportunities are excluded from the active pipeline without deleting or changing stage", () => {
  const active = project("active", "proposal", 100000, 50);
  const archived = project("archived", "negotiation", 200000, 75, "2026-09-03T10:00:00.000Z");
  archived.crm.archiveReasonCode = "municipality_not_interested";
  archived.crm.archiveReason = "Comune non interessato al momento";
  archived.crm.archivedBy = "agent@example.com";

  assert.equal(isArchivedOpportunity(active), false);
  assert.equal(isArchivedOpportunity(archived), true);
  assert.deepEqual(activePipelineProjects([active, archived]).map((item) => item.id), ["active"]);

  const totals = pipelineTotals([active, archived]);
  assert.equal(totals.totalContractValue, 100000);
  assert.equal(totals.weightedTcv, 50000);
  assert.equal(totals.annualRecurringRevenue, 10000);
  assert.equal(probabilityWeightedForecast([active, archived]), 50000);

  const stages = pipelineStageTotals([active, archived]);
  assert.equal(stages.find((item) => item.stage === "proposal").count, 1);
  assert.equal(stages.find((item) => item.stage === "negotiation").count, 0);

  assert.equal(archived.crm.status, "negotiation");
  assert.equal(archived.crm.archiveReasonCode, "municipality_not_interested");
});
