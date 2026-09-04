import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";

test("freight is included exactly once in direct project costs", () => {
  const project = defaultProject({ applyStoredDefaults: false });
  project.solution.smartEnabled = false;
  project.solution.cmsEnabled = false;
  project.solution.powerAidEnabled = false;
  project.assumptions.freightCostPerLamp = 4;
  project.assumptions.freightSalesPerLamp = 6;
  project.assumptions.dutyCost = 0;
  project.assumptions.agent1CommissionPercent = 0;
  project.assumptions.agent2CommissionPercent = 0;
  project.assumptions.warrantyReservePercent = 0;
  project.assumptions.fundingCostPercent = 0;
  project.assumptions.otherDirectCosts = 0;

  const result = calculateBusinessCase(project);

  assert.equal(result.freightCost, 400);
  assert.equal(result.capexDirectCost, 9400);
  assert.equal(result.capexDirectCost - result.freightCost, 9000);
  assert.equal(result.totalDirectCosts, 9400);
});

test("internal P&L shows freight separately without adding it again", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /Costo prodotti e implementazione[^\n]+Math\.max\(0,r\.capexDirectCost-r\.freightCost\)/);
  assert.match(source, /Trasporto \/ logistica[^\n]+r\.freightCost/);
});

test("procurement screen and supplier PDF use locale grouping for quantities", () => {
  const source = fs.readFileSync(new URL("../src/ProcurementPanel.jsx", import.meta.url), "utf8");
  const matches = source.match(/quantity\.format\(item\.quantity\)/g) || [];
  assert.ok(matches.length >= 2, "quantity should be grouped in both PDF and on-screen procurement table");
});
