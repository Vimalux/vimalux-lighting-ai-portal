import test from "node:test";
import assert from "node:assert/strict";
import { isAgentViewAllowed, sanitizeAgentAdditionalCosts } from "./additionalCostsAccess.js";

test("agent edits preserve the admin unit cost and discard supplied internal fields", () => {
  const existing = [{
    id: "poles",
    description: "Nuovi pali",
    category: "materiale",
    costType: "capex",
    quantity: 20,
    unit: "pz",
    unitCost: 100,
    unitSalesPrice: 120,
    note: "",
    internalReference: "admin-only",
  }];
  const incoming = [{
    ...existing[0],
    description: "Nuovi pali rinforzati",
    quantity: 24,
    unitCost: 0,
    unitSalesPrice: 125,
    margin: 999,
  }];

  assert.deepEqual(sanitizeAgentAdditionalCosts(existing, incoming), [{
    id: "poles",
    description: "Nuovi pali rinforzati",
    category: "materiale",
    costType: "capex",
    quantity: 24,
    unit: "pz",
    unitSalesPrice: 125,
    note: "",
    unitCost: 100,
    internalReference: "admin-only",
  }]);
});

test("new agent items receive a neutral internal cost while retaining sales data", () => {
  const result = sanitizeAgentAdditionalCosts([], [{
    id: "new-poles",
    description: "Nuovi pali",
    category: "materiale",
    costType: "capex",
    quantity: 20,
    unit: "pz",
    unitSalesPrice: 120,
    note: "",
  }]);

  assert.equal(result[0].unitCost, 0);
  assert.equal(result[0].quantity * result[0].unitSalesPrice, 2400);
});

test("agent navigation rejects pricing and the full assumptions view", () => {
  const allowed = new Set(["customer", "additionalCosts", "business", "report"]);
  assert.equal(isAgentViewAllowed("additionalCosts", allowed), true);
  assert.equal(isAgentViewAllowed("pricing", allowed), false);
  assert.equal(isAgentViewAllowed("assumptions", allowed), false);
});
