import test from "node:test";
import assert from "node:assert/strict";
import { internalProfitabilityMetrics } from "./profitabilityMetrics.js";
import { defaultProject } from "./model.js";
import { calculateBusinessCase } from "./calculations.js";
import { partnerProjectRows, partnerTotals } from "./partners.js";

test("internal profitability keeps hardware, recurring OPEX, adaptive and total project contribution separate", () => {
  const project = {
    assumptions: { serviceAgreementPeriod: 10, contractYears: 10, powerAidServicePeriod: 10, opexEscalation: 2, energyEscalation: 2, minimumMarginPercent: 30 },
  };
  const result = {
    totalCapex: 100000,
    capexDirectCost: 60000,
    dutyCost: 2000,
    cmsRevenue: 10000,
    cmsDirectCost: 4000,
    gatewayRecurringRevenue: 1000,
    gatewayRecurringCost: 300,
    additionalAnnualOpexSales: 2000,
    additionalAnnualOpexCost: 500,
    fixedAnnualOpex: 13000,
    annualOpexDirectCost: 4800,
    powerAidCustomerFee: 5000,
    powerAidSupplierCost: 3500,
    powerAidVimaluxMargin: 1500,
    powerAidContractRevenue: 55000,
    powerAidSupplierContractCost: 38500,
    totalContractRevenue: 300000,
    totalDirectCosts: 210000,
    netProjectProfit: 90000,
    netProjectMarginPercent: 30,
    minimumMarginPercent: 30,
    serviceAgreementPeriod: 10,
    powerAidServicePeriod: 10,
  };
  const metrics = internalProfitabilityMetrics(project, result);
  assert.equal(metrics.hardware.margin, 38000);
  assert.equal(metrics.cms.marginAnnual, 6000);
  assert.equal(metrics.recurringOpex.marginAnnual, 8200);
  assert.equal(metrics.adaptive.marginAnnual, 1500);
  assert.equal(metrics.project.contribution, 90000);
  assert.equal(metrics.project.marginPercent, 30);
  assert.equal(metrics.project.marginBufferPercent, 0);
});

test("partner economics exposes DATEK and Felicity supplier cost separately from customer sales", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.customer.name = "Test Comune";
  project.project.name = "Profitability Test";
  project.groups[0].quantity = 100;
  project.groups[0].upgradeSelected = true;
  project.solution.smartEnabled = true;
  project.solution.cmsEnabled = true;
  project.solution.powerAidEnabled = true;
  project.solution.cmsPartner = "DATEK";
  project.solution.adaptiveDimmingPartner = "FELICITY";
  project.assumptions.serviceAgreementPeriod = 10;
  project.assumptions.contractYears = 10;
  project.assumptions.powerAidServicePeriod = 10;
  project.assumptions.powerAidCustomerFeePercent = 40;
  project.assumptions.powerAidSupplierSharePercent = 70;
  project.assumptions.opexEscalation = 0;
  project.assumptions.energyEscalation = 0;
  const lcu = project.catalogue.smart.find((item) => item.id === project.solution.lcuProductId);
  lcu.annualSalesPrice = 6;
  lcu.annualCost = 4;

  const result = calculateBusinessCase(project);
  const datek = partnerProjectRows([project], "DATEK", "CMS")[0];
  const felicity = partnerProjectRows([project], "FELICITY", "ADAPTIVE_DIMMING")[0];

  assert.equal(datek.annualCustomerRevenue, result.cmsRevenue);
  assert.equal(datek.annualSupplierCost, result.cmsDirectCost);
  assert.equal(datek.annualVimaluxMargin, result.cmsRevenue - result.cmsDirectCost);
  assert.equal(datek.customerContractValue, result.cmsRevenue * 10);
  assert.equal(datek.supplierContractCost, result.cmsDirectCost * 10);

  assert.equal(felicity.annualCustomerRevenue, result.powerAidCustomerFee);
  assert.equal(felicity.annualSupplierCost, result.powerAidSupplierCost);
  assert.equal(felicity.annualVimaluxMargin, result.powerAidVimaluxMargin);
  assert.equal(felicity.customerContractValue, result.powerAidContractRevenue);
  assert.equal(felicity.supplierContractCost, result.powerAidSupplierContractCost);

  const datekTotals = partnerTotals([project], "DATEK", "CMS");
  assert.equal(datekTotals.annualCustomerRevenue, result.cmsRevenue);
  assert.equal(datekTotals.annualSupplierCost, result.cmsDirectCost);
  assert.equal(datekTotals.contractMargin, datekTotals.customerContractValue - datekTotals.supplierContractCost);
});
