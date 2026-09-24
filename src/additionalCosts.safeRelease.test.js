import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "./calculations.js";
import { defaultProject } from "./model.js";
import { updateAdminAdditionalCostField } from "./additionalCosts.js";
import {
  additionalCostSalesPriceFromSupplierCost,
  sanitizeAgentAdditionalCosts,
} from "./additionalCostsAccess.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";
import { buildCustomerCapexRows } from "./reportPresentation.js";

function financedProject() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.assumptions = {
    ...project.assumptions,
    dealType: "noleggio_operativo",
    financingModel: "laas",
    financingPeriod: 10,
    financingYears: 10,
    serviceAgreementPeriod: 20,
    contractYears: 20,
    analysisPeriod: 20,
    interestRate: 7,
    rateProfileId: "custom",
    interestRateSnapshot: { profileId: "custom", annualRate: 7, capturedAt: null },
    allInclusiveAnnualPayment: 0,
    officialOfferCapex: 0,
    officialAnnualOpex: 0,
    upfrontPayment: 0,
  };
  project.solution = { ...project.solution, warrantyYears: 5 };
  project.additionalCosts = [];
  return project;
}

const extraCapex = {
  id: "extra-work",
  description: "Opere aggiuntive",
  category: "lavoro",
  costType: "capex",
  quantity: 1,
  unit: "forfait",
  unitCost: 8000,
  unitSalesPrice: 10000,
  note: "",
};

test("SAFE RELEASE: admin supplier cost gets a non-zero customer CAPEX price by default but preserves manual override", () => {
  const blank = {
    id: "admin-extra",
    description: "Extra work",
    category: "lavoro",
    costType: "capex",
    quantity: 1,
    unit: "forfait",
    unitCost: 0,
    unitSalesPrice: 0,
    note: "",
  };

  const firstCost = updateAdminAdditionalCostField(blank, "unitCost", 5000);
  assert.equal(firstCost.unitCost, 5000);
  assert.equal(firstCost.unitSalesPrice, 5000);

  const manuallyPriced = updateAdminAdditionalCostField(firstCost, "unitSalesPrice", 6500);
  const laterCostChange = updateAdminAdditionalCostField(manuallyPriced, "unitCost", 5200);
  assert.equal(laterCostChange.unitCost, 5200);
  assert.equal(laterCostChange.unitSalesPrice, 6500);
});

test("SAFE RELEASE: additional CAPEX propagates through financing, customer payment, TCV and customer economics", () => {
  const baseProject = financedProject();
  const withExtraProject = { ...baseProject, additionalCosts: [extraCapex] };
  const baseline = calculateBusinessCase(baseProject);
  const withExtra = calculateBusinessCase(withExtraProject);

  assert.equal(withExtra.additionalCapexCost, 8000);
  assert.equal(withExtra.additionalCapexSales, 10000);
  assert.equal(withExtra.totalCapex - baseline.totalCapex, 10000);
  assert.ok(withExtra.financingMonthlyPayment > baseline.financingMonthlyPayment);
  assert.ok(withExtra.financingAnnualPayment > baseline.financingAnnualPayment);
  assert.ok(withExtra.customerAnnualPayment > baseline.customerAnnualPayment);
  assert.ok(withExtra.totalContractRevenue > baseline.totalContractRevenue);
  assert.ok(withExtra.customerAnnualNetBenefit < baseline.customerAnnualNetBenefit);
  assert.ok(withExtra.npv < baseline.npv);
});

test("SAFE RELEASE: CRM/Business Case snapshot receives the same recalculated CAPEX, payment and TCV", () => {
  const baseProject = financedProject();
  const withExtraProject = { ...baseProject, additionalCosts: [extraCapex] };
  const baseline = buildBusinessCaseSnapshot(baseProject, "2026-09-24T12:00:00.000Z");
  const withExtra = buildBusinessCaseSnapshot(withExtraProject, "2026-09-24T12:00:00.000Z");

  assert.equal(withExtra.capex - baseline.capex, 10000);
  assert.ok(withExtra.monthlyCustomerPayment > baseline.monthlyCustomerPayment);
  assert.ok(withExtra.annualCustomerPayment > baseline.annualCustomerPayment);
  assert.ok(withExtra.tcv > baseline.tcv);
  assert.ok(withExtra.annualCustomerNetBenefit < baseline.annualCustomerNetBenefit);
});

test("SAFE RELEASE: customer report CAPEX breakdown includes and reconciles the additional item", () => {
  const project = financedProject();
  project.additionalCosts = [extraCapex];
  const result = calculateBusinessCase(project);
  const breakdown = buildCustomerCapexRows(
    project,
    result.totalCapex,
    "it",
    result.additionalCapexSales,
  );

  assert.equal(breakdown.additionsCount, 1);
  assert.equal(breakdown.additionsTotal, 10000);
  assert.equal(breakdown.baseCapex + breakdown.additionsTotal, result.totalCapex);
  assert.ok(breakdown.rows.some((row) => row[0] === "Opere aggiuntive"));
});

test("SAFE RELEASE: deleting additional CAPEX restores all affected economic values exactly", () => {
  const baseProject = financedProject();
  const baseline = calculateBusinessCase(baseProject);
  const withExtraProject = { ...baseProject, additionalCosts: [extraCapex] };
  const withExtra = calculateBusinessCase(withExtraProject);
  assert.notEqual(withExtra.totalCapex, baseline.totalCapex);

  const reverted = calculateBusinessCase({ ...withExtraProject, additionalCosts: [] });
  for (const key of [
    "totalCapex",
    "financingMonthlyPayment",
    "financingAnnualPayment",
    "customerAnnualPayment",
    "totalContractRevenue",
    "customerAnnualNetBenefit",
    "npv",
  ]) {
    assert.equal(reverted[key], baseline[key], `expected ${key} to return to baseline`);
  }
});

test("SAFE RELEASE: agent supplier cost uses hidden 15 percent customer price and affects live economics", () => {
  const baseProject = financedProject();
  const agentRows = sanitizeAgentAdditionalCosts([], [{
    id: "agent-extra",
    description: "Lavoro extra",
    category: "lavoro",
    costType: "capex",
    quantity: 1,
    unit: "forfait",
    unitCost: 1000,
    note: "",
  }]);

  assert.equal(additionalCostSalesPriceFromSupplierCost(1000), 1150);
  assert.equal(agentRows[0].unitSalesPrice, 1150);

  const baseline = calculateBusinessCase(baseProject);
  const withAgentCost = calculateBusinessCase({ ...baseProject, additionalCosts: agentRows });
  assert.equal(withAgentCost.totalCapex - baseline.totalCapex, 1150);
  assert.ok(withAgentCost.customerAnnualPayment > baseline.customerAnnualPayment);
});
