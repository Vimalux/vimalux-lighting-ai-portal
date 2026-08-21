import test from "node:test";
import assert from "node:assert/strict";
import { defaultProject } from "./model.js";
import { calculateBusinessCase } from "./calculations.js";
import { partnerProjectRows } from "./partners.js";

test("VIMALUX partner report uses actual LCU, ARR and contract value", () => {
  const project = defaultProject();
  project.additionalCosts = [
    {
      id: "poles",
      description: "Nuovi pali",
      category: "materiale",
      costType: "capex",
      quantity: 20,
      unit: "pz",
      unitCost: 100,
      unitSalesPrice: 120,
      note: "",
    },
    {
      id: "service",
      description: "Servizio aggiuntivo",
      category: "servizi",
      costType: "opex_annual",
      quantity: 20,
      unit: "pz",
      unitCost: 4,
      unitSalesPrice: 6,
      note: "",
    },
  ];

  const result = calculateBusinessCase(project);
  const [row] = partnerProjectRows([project], "VIMALUX");

  assert.equal(row.lcus, result.lcuQuantity);
  assert.equal(row.arr, result.annualRecurringRevenue);
  assert.equal(row.annualRevenue, result.annualRecurringRevenue);
  assert.equal(row.totalContractValue, result.totalContractRevenue);
});
