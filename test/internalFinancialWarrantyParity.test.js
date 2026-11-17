import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "../src/model.js";
import { calculateBusinessCase } from "../src/calculations.js";
import { applyWarrantyPricing } from "../src/warranty.js";
import { buildBusinessCaseSnapshot } from "../src/businessCaseSync.js";
import { buildCrmInternalFinancials } from "../src/crmInternalFinancials.js";
import { persistIntelligenceProject } from "../src/businessCasePersistence.js";
import { simulateScenario } from "../src/scenarioOptimizer.js";
import { partnerProjectRows } from "../src/partners.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} differs from ${b}`);

function extendedWarrantyProject() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.id = "11111111-1111-4111-8111-111111111111";
  project.crm.businessCaseRecordId = project.id;
  project.crm.opportunityId = "22222222-2222-4222-8222-222222222222";
  project.customer.name = "Test Comune";
  project.project.name = "Warranty parity audit";
  project.solution.warrantyYears = 10;
  project.assumptions.dealType = "finance";
  project.assumptions.interestRate = 8;
  project.assumptions.fundingCostPercent = 6;
  project.assumptions.financingPeriod = 10;
  project.assumptions.financingYears = 10;
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.powerAidServicePeriod = 10;
  project.assumptions.agent1CommissionPercent = 8;
  project.assumptions.agent2CommissionPercent = 15;
  project.assumptions.warrantyReservePercent = 2;
  project.additionalCosts = [
    { id: "installation", description: "Installazione e smaltimento", category: "servizi", costType: "capex", quantity: 100, unit: "pz", unitCost: 30, unitSalesPrice: 35 },
  ];
  return project;
}

test("every calculation entry point applies extended warranty exactly once", () => {
  const project = extendedWarrantyProject();
  const direct = calculateBusinessCase(project, { publish: false });
  const prepriced = calculateBusinessCase(applyWarrantyPricing(project), { publish: false });
  const standard = calculateBusinessCase({ ...project, solution: { ...project.solution, warrantyYears: 5 } }, { publish: false });
  const uplift = 100 * 150 * 0.1819;
  near(direct.totalCapex - standard.totalCapex, uplift);
  for (const field of ["ledCapex", "totalCapex", "totalContractRevenue", "commissionCost", "netProjectProfit", "netProjectMarginPercent"]) {
    near(direct[field], prepriced[field]);
  }
  assert.equal(project.catalogue.led[0].salesPrice, 150, "stored catalogue stays untouched");

  const snapshot = buildBusinessCaseSnapshot(project);
  near(snapshot.capex, direct.totalCapex);
  near(snapshot.tcv, direct.totalContractRevenue);
  near(snapshot.annualCustomerPayment, direct.customerAnnualPayment);

  const partner = partnerProjectRows([project], "VIMALUX")[0];
  near(partner.customerContractValue, direct.totalContractRevenue);
  near(partner.contractMargin, direct.netProjectProfit);

  const scenario = simulateScenario(project, { financingYears: 10, cmsYears: 10, adaptiveYears: 1, horizonYears: 15 });
  near(scenario.totalCapex, direct.totalCapex);
});

test("CRM writeback and internal report reconcile on one warranty-priced snapshot", async () => {
  const project = extendedWarrantyProject();
  const result = calculateBusinessCase(project, { publish: false });
  let captured;
  const client = { rpc: async (name, args) => {
    assert.equal(name, "save_business_case_intelligence");
    captured = args;
    return { data: true, error: null };
  } };
  await persistIntelligenceProject(client, project, { role: "admin" });
  const payload = captured.project_payload;
  const financial = payload.internalFinancial;
  near(captured.calculated_result.capex, result.totalCapex);
  near(payload.commercialSnapshot.offerCapex, result.totalCapex);
  near(payload.commercialSnapshot.totalContractRevenue, result.totalContractRevenue);
  near(payload.commercialSnapshot.customerAnnualPayment, result.customerAnnualPayment);
  near(financial.agent_commission, result.commissionCost);
  near(financial.total_direct_costs, result.totalDirectCosts);
  near(financial.internal_report_revenue, result.vimaluxRevenue);
  near(financial.internal_report_direct_costs, result.vimaluxDirectCosts);
  near(financial.internal_report_contribution, result.netProjectProfit);
  near(financial.internal_report_margin_percent, result.netProjectMarginPercent);
  near(financial.receivables_discount, result.financeReceivablesDiscount);
  near(financial.total_direct_costs - financial.internal_report_direct_costs, result.financeReceivablesDiscount);
  near(financial.installation_costs, result.implementationCost + 100 * 30);

  const summedCosts = ["luminaire_costs", "datek_costs", "felicity_costs", "installation_costs", "freight_costs", "other_direct_costs", "agent_commission", "finance_costs"]
    .reduce((sum, key) => sum + financial[key], 0);
  near(summedCosts, financial.total_direct_costs);
});

test("manually quoted group LED prices retain priority over catalogue warranty uplift", () => {
  const project = extendedWarrantyProject();
  project.groups[0].projectLedPrice = 200;
  const direct = calculateBusinessCase(project, { publish: false });
  const prepriced = calculateBusinessCase(applyWarrantyPricing(project), { publish: false });
  near(direct.ledCapex, 100 * 200);
  near(direct.totalCapex, prepriced.totalCapex);
});
