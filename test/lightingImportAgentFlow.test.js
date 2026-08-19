import test from "node:test";
import assert from "node:assert/strict";
import { buildImportedGroups, recommendLedProduct } from "../src/lightingImport.js";

const products = [
  { id: "led-10", wattage: 10, active: true },
  { id: "led-20", wattage: 20, active: true },
  { id: "led-30", wattage: 30, active: true },
  { id: "led-40", wattage: 40, active: true },
  { id: "led-60", wattage: 60, active: true },
  { id: "led-80", wattage: 80, active: true },
];

test("grouped agent import aggregates by technology and wattage, not street/name", () => {
  const rows = [
    ["Street A", "HPS", 70, 1],
    ["Street B", "SAP", 70, 2],
    ["Street C", "LED", 70, 1],
  ];
  const result = buildImportedGroups(
    rows,
    { name: "0", technology: "1", wattage: "2", quantity: "3", assetId: "" },
    products,
    "en",
    "grouped",
  );
  assert.equal(result.totalQuantity, 4);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find((group) => group.technology === "SAP").quantity, 3);
  assert.equal(result.groups.find((group) => group.technology === "LED").quantity, 1);
});

test("individual UI mode falls back to grouped when no asset ID is mapped", () => {
  const rows = [["Street A", "HPS", 70, 1], ["Street B", "HPS", 70, 1]];
  const result = buildImportedGroups(
    rows,
    { name: "0", technology: "1", wattage: "2", quantity: "3", assetId: "" },
    products,
    "en",
    "individual",
  );
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].quantity, 2);
});

test("old technology uses approximately one third wattage for LED recommendation", () => {
  const recommendation = recommendLedProduct(70, "SAP", products);
  assert.equal(recommendation.targetWattage, 23.3);
  assert.equal(recommendation.product.id, "led-20");
});

test("existing LED uses 30 percent lower wattage for recommendation", () => {
  const recommendation = recommendLedProduct(70, "LED", products);
  assert.equal(recommendation.targetWattage, 49);
  assert.equal(recommendation.product.id, "led-40");
});
