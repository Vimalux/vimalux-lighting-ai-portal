import test from "node:test";
import assert from "node:assert/strict";
import { calculateAdditionalCosts } from "./additionalCosts.js";

test("mixed project costs are separated into CAPEX and annual OPEX", () => {
  const result = calculateAdditionalCosts([
    { description: "Nuovi pali", category: "materiale", costType: "capex", quantity: 4, unit: "pz", unitCost: 250, unitSalesPrice: 400 },
    { description: "Servizio", category: "servizi", costType: "opex_annual", quantity: 1, unit: "anno", unitCost: 300, unitSalesPrice: 600 },
  ]);
  assert.equal(result.capexCost, 1000);
  assert.equal(result.capexSales, 1600);
  assert.equal(result.annualOpexCost, 300);
  assert.equal(result.annualOpexSales, 600);
});
