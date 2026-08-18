import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { applyAuthoritativeBusinessCase, buildBusinessCaseSnapshot } from "../src/businessCaseSync.js";
import { calculateWeightedArr, calculateWeightedTcv, crmMetrics } from "../src/crm.js";
import { applyOpportunityToProject, buildPlannerHandoff, canCreatePlannerProject, mergeOpportunity } from "../src/opportunity.js";
import { parseOpportunityWorkbook, validateOpportunity } from "../src/opportunityImport.js";

const agentSheet = (overrides = {}) => [{ name: "VML Agent Input Sheet", headers: ["opportunity_id", "municipality_name", "project_name", "total_luminaires", "average_existing_watt", "annual_operating_hours", "energy_price", "existing_dimming_profile", "existing_dimming_pct", "financing_model", "financing_period_years", "service_agreement_period_years", "analysis_period_years"], rows: [["OP-1", "Comune Test", "LED Test", "1250", "100", "4200", "0,25", "Fixed", "20", "Financed", 5, 10, 20].map((value, index) => overrides[index] ?? value)] }];

test("new customer and new opportunity import maps to canonical project", () => {
  const parsed = parseOpportunityWorkbook(agentSheet(), "agent");
  const merged = mergeOpportunity([], parsed.opportunities[0]);
  assert.equal(merged.action, "created");
  assert.equal(merged.project.customer.name, "Comune Test");
  assert.equal(merged.project.crm.opportunityId, "OP-1");
  assert.equal(merged.project.groups[0].quantity, 1250);
});

test("existing customer can receive a new opportunity without changing the customer name", () => {
  const first = applyOpportunityToProject(parseOpportunityWorkbook(agentSheet(), "agent").opportunities[0]);
  const secondOpportunity = parseOpportunityWorkbook(agentSheet({ 0: "OP-2", 2: "Second project" }), "agent").opportunities[0];
  const merged = mergeOpportunity([first], secondOpportunity);
  assert.equal(merged.action, "created");
  assert.equal(merged.projects.length, 2);
  assert.equal(merged.projects[1].customer.name, "Comune Test");
  assert.equal(merged.projects[1].crm.customerId, first.id);
});

test("reimport same opportunity ID updates without duplicate", () => {
  const opportunity = parseOpportunityWorkbook(agentSheet(), "agent").opportunities[0];
  const first = mergeOpportunity([], opportunity);
  const changed = structuredClone(opportunity); changed.opportunity.projectName = "Updated project";
  const second = mergeOpportunity(first.projects, changed);
  assert.equal(second.action, "updated");
  assert.equal(second.projects.length, 1);
  assert.equal(second.project.project.name, "Updated project");
});

test("legacy CRM import remains supported", () => {
  const sheets = [{ name: "CRM_IMPORT", headers: ["Field", "Value"], rows: [["project_name", "Legacy"], ["customer_name", "Comune Legacy"], ["quotation_id", "Q-1"], ["lamps", 100], ["capex", 50000], ["contract_years", 10], ["financing_years", 5], ["customer_cost_cash_annual", 12000], ["total_opex_annual", 500]] }];
  const parsed = parseOpportunityWorkbook(sheets, "legacy");
  const project = applyOpportunityToProject(parsed.opportunities[0]);
  assert.equal(project.customer.name, "Comune Legacy");
  assert.equal(project.assumptions.officialOfferCapex, 50000);
});

test("probability weights authoritative TCV and ARR exactly once", () => {
  assert.equal(calculateWeightedTcv(100000, 50), 50000);
  assert.equal(calculateWeightedArr(20000, 50), 10000);
  const project = defaultProject(); project.crm.closingProbability = 50; project.crm.businessCase = { tcv: 100000, arr: 20000 };
  assert.equal(crmMetrics(project).weightedTcv, 50000);
});

test("financed periods remain 5 finance, 10 service and 20 analysis", () => {
  const opportunity = parseOpportunityWorkbook(agentSheet(), "agent").opportunities[0];
  const project = applyOpportunityToProject(opportunity);
  assert.equal(project.assumptions.dealType, "finance");
  assert.equal(project.assumptions.financingPeriod, 5);
  assert.equal(project.assumptions.serviceAgreementPeriod, 10);
  assert.equal(project.assumptions.analysisPeriod, 20);
});

test("cash keeps upfront CAPEX and optional service separately", () => {
  const opportunity = parseOpportunityWorkbook(agentSheet({ 9: "Cash", 10: 1, 11: 10, 12: 20 }), "agent").opportunities[0];
  const project = applyOpportunityToProject(opportunity);
  const result = buildBusinessCaseSnapshot(project);
  assert.equal(project.assumptions.dealType, "cash");
  assert.ok(result.capex > 0);
  assert.ok(result.annualOpex >= 0);
});

test("LaaS maps to one all-inclusive commercial model", () => {
  const opportunity = parseOpportunityWorkbook(agentSheet({ 9: "Lighting as a Service" }), "agent").opportunities[0];
  const project = applyOpportunityToProject(opportunity);
  assert.equal(project.assumptions.dealType, "noleggio_operativo");
});

test("existing dimming values import correctly", () => {
  const opportunity = parseOpportunityWorkbook(agentSheet(), "agent").opportunities[0];
  const project = applyOpportunityToProject(opportunity);
  assert.equal(project.groups[0].existingDimmingProfile, "fixed");
  assert.equal(project.groups[0].existingDimmingPercent, 20);
});

test("missing optional fields do not crash import", () => {
  const sheets = [{ name: "VML Agent Input Sheet", headers: ["municipality_name", "project_name"], rows: [["Comune Minimal", "Minimal"]] }];
  const parsed = parseOpportunityWorkbook(sheets, "agent");
  assert.deepEqual(validateOpportunity(parsed.opportunities[0]), []);
  assert.equal(applyOpportunityToProject(parsed.opportunities[0]).customer.name, "Comune Minimal");
});

test("comma and dot numeric formats are accepted", () => {
  const parsed = parseOpportunityWorkbook(agentSheet({ 3: "1.250,00", 6: "0.25" }), "agent").opportunities[0];
  assert.equal(parsed.assumptions.totalLuminaires, 1250);
  assert.equal(parsed.assumptions.energyPrice, 0.25);
});

test("authoritative Business Case sync updates only the selected opportunity", () => {
  const first = defaultProject(); first.id = "A"; first.crm.opportunityId = "OP-A";
  const second = defaultProject(); second.id = "B"; second.crm.opportunityId = "OP-B";
  const updated = [first, second].map((project) => project.crm.opportunityId === "OP-B" ? applyAuthoritativeBusinessCase(project, { tcv: 100000, arr: 12000, calculatedAt: "2026-08-18T10:00:00Z" }) : project);
  assert.equal(updated[0].crm.businessCase, null);
  assert.equal(updated[1].crm.businessCase.tcv, 100000);
});

test("Planner handoff is gated by GO and transfers aggregates only", () => {
  let project = defaultProject();
  assert.equal(canCreatePlannerProject(project), false);
  project = applyAuthoritativeBusinessCase(project, { goStatus: "GO", calculatedAt: "2026-08-18T10:00:00Z" });
  project.crm.goStatus = "GO";
  assert.equal(canCreatePlannerProject(project), true);
  const handoff = buildPlannerHandoff(project);
  assert.equal(handoff.preliminaryAggregateAssumptions.totalLuminaires, 100);
  assert.equal("gps" in handoff, false);
});
