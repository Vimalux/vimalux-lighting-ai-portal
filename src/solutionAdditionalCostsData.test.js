import assert from "node:assert/strict";
import test from "node:test";
import { solutionAdditionalCostRows } from "./solutionAdditionalCostsData.js";

test("Solution summary shows each extra CAPEX line with customer amounts only", () => {
  const input = { additionalCosts: [
    { id: "install", description: "Installazione apparecchi LED", costType: "capex", quantity: 100, unit: "pz", unitCost: 30, unitSalesPrice: 35 },
    { id: "opex", description: "Manutenzione", costType: "opex_annual", quantity: 1, unitCost: 10, unitSalesPrice: 20 },
  ] };
  const capex = solutionAdditionalCostRows(input, "capex");
  assert.deepEqual(capex, [{ id: "install", description: "Installazione apparecchi LED", quantity: 100, unit: "pz", unitSalesPrice: 35, salesTotal: 3500 }]);
  assert.ok(!JSON.stringify(capex).includes("unitCost"));
  assert.deepEqual(solutionAdditionalCostRows(input, "opex_annual").map((row) => row.salesTotal), [20]);
});
