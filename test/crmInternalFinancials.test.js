import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmInternalFinancials } from "../src/crmInternalFinancials.js";

test("Intelligence internal costs map to CRM buckets and reconcile to total direct costs", () => {
  const project = {
    assumptions: {
      serviceAgreementPeriod: 3,
      opexEscalation: 10,
    },
  };
  const result = {
    serviceAgreementPeriod: 3,
    ledCost: 100,
    smartHardwareCost: 30,
    implementationCost: 20,
    gatewayCost: 5,
    antennaCost: 2,
    meterCost: 3,
    freightCost: 10,
    cmsDirectCost: 10,
    gatewayRecurringCost: 2,
    powerAidSupplierContractCost: 15,
    commissionCost: 12,
    financingCost: 8,
    totalDirectCosts: 300,
  };

  const mapped = buildCrmInternalFinancials(project, result);

  assert.equal(mapped.luminaire_costs, 100);
  assert.equal(mapped.installation_costs, 20);
  assert.equal(mapped.freight_costs, 10);
  assert.equal(mapped.agent_commission, 12);
  assert.equal(mapped.finance_costs, 8);
  assert.equal(mapped.felicity_costs, 15);
  assert.ok(Math.abs(mapped.datek_costs - 79.72) < 1e-9);
  assert.ok(Math.abs(mapped.other_direct_costs - 55.28) < 1e-9);

  const reconciled = mapped.luminaire_costs
    + mapped.datek_costs
    + mapped.felicity_costs
    + mapped.installation_costs
    + mapped.freight_costs
    + mapped.other_direct_costs
    + mapped.agent_commission
    + mapped.finance_costs;
  assert.ok(Math.abs(reconciled - mapped.total_direct_costs) < 1e-9);
  assert.equal(mapped.total_direct_costs, 300);
});

test("CRM-owned commercial fields are not present in the Intelligence cost payload", () => {
  const mapped = buildCrmInternalFinancials({ assumptions: {} }, { totalDirectCosts: 0 });

  for (const key of [
    "revenue_basis",
    "cash_selling_price",
    "financed_selling_price",
    "margin_basis_eur",
    "bonus",
    "minimum_margin_pct",
  ]) {
    assert.equal(Object.hasOwn(mapped, key), false, `${key} must remain CRM-owned`);
  }
});
