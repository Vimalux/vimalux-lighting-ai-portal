import test from "node:test";
import assert from "node:assert/strict";
import { reconcileImportedGroupProduct } from "../src/importedProductCategoryReconcile.js";

const products = [
  { id: "manta-30", active: true, name: "VIMALUX MANTA 30", wattage: 30 },
  { id: "manta-50", active: true, name: "VIMALUX MANTA 50", wattage: 50 },
  { id: "opera-25", active: true, name: "VIMALUX OPERA 25", wattage: 25 },
  { id: "opera-40", active: true, name: "VIMALUX OPERA 40", wattage: 40 },
];

test("imported Arredo urbano cannot keep a MANTA product id", () => {
  const result = reconcileImportedGroupProduct({
    technology: "LED",
    existingWattage: 42,
    luminaireCategory: "Arredo urbano",
    proposedProductId: "manta-30",
    projectLedWattage: 30,
  }, products);
  assert.equal(result.proposedProductId, "opera-25");
  assert.equal(result.projectLedWattage, 25);
});

test("compatible OPERA selection is preserved for Arredo urbano", () => {
  const group = {
    technology: "SAP",
    existingWattage: 70,
    luminaireCategory: "Arredo urbano",
    proposedProductId: "opera-25",
    projectLedWattage: 25,
  };
  const result = reconcileImportedGroupProduct(group, products);
  assert.equal(result, group);
});

test("Stradale cannot keep an OPERA product id", () => {
  const result = reconcileImportedGroupProduct({
    technology: "LED",
    existingWattage: 47,
    luminaireCategory: "Stradale",
    proposedProductId: "opera-40",
    projectLedWattage: 40,
  }, products);
  assert.equal(result.proposedProductId, "manta-30");
});
