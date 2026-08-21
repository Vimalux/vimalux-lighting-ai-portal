import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "./calculations.js";
import { defaultProject } from "./model.js";

test("additional CAPEX increases project CAPEX, financing base and direct cost", () => {
  const project = defaultProject();
  project.additionalCosts = [
    {
      id: "poles",
      description: "Nuovi pali",
      category: "materiale",
      costType: "capex",
      quantity: 10,
      unit: "pz",
      unitCost: 300,
      unitSalesPrice: 450,
      note: "",
    },
  ];

  const withoutExtra = calculateBusinessCase({ ...project, additionalCosts: [] });
  const withExtra = calculateBusinessCase(project);

  assert.equal(withExtra.additionalCapexCost, 3000);
  assert.equal(withExtra.additionalCapexSales, 4500);
  assert.equal(withExtra.totalCapex - withoutExtra.totalCapex, 4500);
  assert.equal(withExtra.capexDirectCost - withoutExtra.capexDirectCost, 3000);
});

test("annual additional OPEX changes annual customer payment and project direct cost", () => {
  const project = defaultProject();
  project.additionalCosts = [
    {
      id: "annual-service",
      description: "Servizio annuale aggiuntivo",
      category: "servizi",
      costType: "opex_annual",
      quantity: 1,
      unit: "anno",
      unitCost: 400,
      unitSalesPrice: 750,
      note: "",
    },
  ];

  const withoutExtra = calculateBusinessCase({ ...project, additionalCosts: [] });
  const withExtra = calculateBusinessCase(project);

  assert.equal(withExtra.additionalAnnualOpexCost, 400);
  assert.equal(withExtra.additionalAnnualOpexSales, 750);
  assert.equal(withExtra.totalAnnualOpex - withoutExtra.totalAnnualOpex, 750);
  assert.equal(withExtra.annualOpexDirectCost - withoutExtra.annualOpexDirectCost, 400);
  assert.equal(withExtra.customerAnnualPayment - withoutExtra.customerAnnualPayment, 750);
});
