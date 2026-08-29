import test from "node:test";
import assert from "node:assert/strict";
import { reconciliationChanges, reconcileImportedProjectProductCategories } from "./importedProductCategoryReconcile.js";

const catalogue = [
  { id: "OPERA-25", productCategory: "URBAN", compatibleExistingCategories: ["URBAN"], wattage: 25, active: true },
  { id: "FLOLY-25", productCategory: "FLOODLIGHT", compatibleExistingCategories: ["FLOODLIGHT"], wattage: 25, active: true },
  { id: "MANTA-30", productCategory: "STREET", compatibleExistingCategories: ["STREET"], wattage: 30, active: true },
];

function projectWith(groups) {
  return {
    id: "case-1",
    importedTechnical: { fileName: "input.xlsx" },
    catalogue: { led: catalogue },
    groups,
  };
}

test("detects an obsolete FLOODLIGHT to OPERA assignment and proposes FLOLY", () => {
  const project = projectWith([{ luminaireCategory: "FLOODLIGHT", technology: "SAP", existingWattage: 70, proposedProductId: "OPERA-25", projectLedWattage: 25 }]);
  const changes = reconciliationChanges(project);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].oldProductId, "OPERA-25");
  assert.equal(changes[0].newProductId, "FLOLY-25");
  assert.equal(changes[0].category, "FLOODLIGHT");
});

test("keeps compatible manual assignments unchanged", () => {
  const project = projectWith([{ luminaireCategory: "FLOODLIGHT", technology: "SAP", existingWattage: 70, proposedProductId: "FLOLY-25", projectLedWattage: 25 }]);
  assert.deepEqual(reconciliationChanges(project), []);
  assert.equal(reconcileImportedProjectProductCategories(project), project);
});

test("reconciles only incompatible rows and preserves all unrelated Business Case data", () => {
  const project = {
    ...projectWith([
      { id: "g1", quantity: 4, luminaireCategory: "FLOODLIGHT", technology: "SAP", existingWattage: 70, proposedProductId: "OPERA-25", projectLedWattage: 25 },
      { id: "g2", quantity: 20, luminaireCategory: "STREET", technology: "LED", existingWattage: 40, proposedProductId: "MANTA-30", projectLedWattage: 30 },
    ]),
    assumptions: { energyPrice: 0.29 },
    crm: { opportunityId: "opp-1" },
    pricing: { overrides: { x: 1 } },
  };
  const next = reconcileImportedProjectProductCategories(project);
  assert.equal(next.groups[0].proposedProductId, "FLOLY-25");
  assert.equal(next.groups[1].proposedProductId, "MANTA-30");
  assert.deepEqual(next.assumptions, project.assumptions);
  assert.deepEqual(next.crm, project.crm);
  assert.deepEqual(next.pricing, project.pricing);
  assert.equal(next.groups[0].quantity, 4);
  assert.equal(next.groups[0].existingWattage, 70);
});
