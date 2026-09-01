import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_ADDITIONAL_COST_MARKUP_PERCENT,
  isAgentViewAllowed,
  sanitizeAgentAdditionalCosts,
} from "./additionalCostsAccess.js";

test("agent supplier-cost edits recalculate project price with hidden default markup", () => {
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
    unitCost: 110,
    unitSalesPrice: 999,
    margin: 999,
  }];

  const result = sanitizeAgentAdditionalCosts(existing, incoming);
  assert.equal(AGENT_ADDITIONAL_COST_MARKUP_PERCENT, 15);
  assert.equal(result[0].unitCost, 110);
  assert.equal(result[0].unitSalesPrice, 126.5);
  assert.equal(result[0].internalReference, "admin-only");
  assert.equal(result[0].description, "Nuovi pali rinforzati");
  assert.equal(result[0].quantity, 24);
});

test("non-price agent edits preserve an existing approved project price", () => {
  const existing = [{
    id: "installation",
    description: "Installazione",
    category: "lavoro",
    costType: "capex",
    quantity: 1,
    unit: "forfait",
    unitCost: 82000,
    unitSalesPrice: 90000,
    note: "admin baseline",
  }];
  const incoming = [{ ...existing[0], note: "updated note", unitSalesPrice: 1 }];
  const result = sanitizeAgentAdditionalCosts(existing, incoming);

  assert.equal(result[0].unitCost, 82000);
  assert.equal(result[0].unitSalesPrice, 90000);
  assert.equal(result[0].note, "updated note");
});

test("new agent items use supplier cost and receive automatic 15 percent project markup", () => {
  const result = sanitizeAgentAdditionalCosts([], [{
    id: "new-poles",
    description: "Nuovi pali",
    category: "materiale",
    costType: "capex",
    quantity: 20,
    unit: "pz",
    unitCost: 120,
    unitSalesPrice: 1,
    note: "",
  }]);

  assert.equal(result[0].unitCost, 120);
  assert.equal(result[0].unitSalesPrice, 138);
  assert.equal(result[0].quantity * result[0].unitSalesPrice, 2760);
});

test("agent can append a project-specific supplier cost without changing existing admin pricing", () => {
  const existing = [{
    id: "installation",
    description: "Installazione",
    category: "lavoro",
    costType: "capex",
    quantity: 1,
    unit: "forfait",
    unitCost: 82000,
    unitSalesPrice: 90000,
    note: "admin baseline",
  }];

  const incoming = [
    { ...existing[0] },
    {
      id: "agent-extra-work",
      description: "Opere aggiuntive rilevate dall'agente",
      category: "opere_civili",
      costType: "capex",
      quantity: 2,
      unit: "pz",
      unitCost: 750,
      note: "Da verificare in sopralluogo",
    },
  ];

  const result = sanitizeAgentAdditionalCosts(existing, incoming);

  assert.equal(result.length, 2);
  assert.equal(result[0].unitCost, 82000);
  assert.equal(result[0].unitSalesPrice, 90000);
  assert.equal(result[1].unitCost, 750);
  assert.equal(result[1].unitSalesPrice, 862.5);
  assert.equal(result[1].description, "Opere aggiuntive rilevate dall'agente");
});

test("agent navigation allows additional project costs while protecting internal pricing", () => {
  const allowed = new Set(["customer", "additionalCosts", "assumptions", "business", "report"]);
  assert.equal(isAgentViewAllowed("additionalCosts", allowed), true);
  assert.equal(isAgentViewAllowed("pricing", allowed), false);
  assert.equal(isAgentViewAllowed("assumptions", allowed), true);
});
