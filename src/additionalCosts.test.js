import test from "node:test";
import assert from "node:assert/strict";
import { calculateAdditionalCosts } from "./additionalCosts.js";

test("splits additional CAPEX and annual OPEX and calculates margins", () => {
  const result = calculateAdditionalCosts([
    {
      id: "poles",
      description: "Nuovi pali",
      category: "materiale",
      costType: "capex",
      quantity: 12,
      unit: "pz",
      unitCost: 280,
      unitSalesPrice: 425,
    },
    {
      id: "labour",
      description: "Manodopera supplementare",
      category: "lavoro",
      costType: "capex",
      quantity: 20,
      unit: "ore",
      unitCost: 35,
      unitSalesPrice: 55,
    },
    {
      id: "service",
      description: "Servizio annuale aggiuntivo",
      category: "servizi",
      costType: "opex_annual",
      quantity: 1,
      unit: "anno",
      unitCost: 500,
      unitSalesPrice: 900,
    },
  ]);

  assert.equal(result.capexCost, 4060);
  assert.equal(result.capexSales, 6200);
  assert.equal(result.capexMargin, 2140);
  assert.equal(result.annualOpexCost, 500);
  assert.equal(result.annualOpexSales, 900);
  assert.equal(result.annualOpexMargin, 400);
});

test("normalizes invalid or negative numeric values safely", () => {
  const result = calculateAdditionalCosts([
    {
      description: "Test",
      costType: "invalid",
      quantity: -2,
      unitCost: "10,50",
      unitSalesPrice: "20,00",
    },
  ]);

  assert.equal(result.rows[0].costType, "capex");
  assert.equal(result.rows[0].quantity, 0);
  assert.equal(result.capexCost, 0);
  assert.equal(result.capexSales, 0);
});
