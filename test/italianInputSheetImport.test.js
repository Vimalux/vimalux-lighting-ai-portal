import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOfficialInputSheetLayout,
  buildImportedGroups,
  guessLightingMapping,
  parseWattageValue,
} from "../src/lightingImport.js";

const products = [
  { id: "led-30", wattage: 30, active: true },
  { id: "led-40", wattage: 40, active: true },
  { id: "led-50", wattage: 50, active: true },
  { id: "led-70", wattage: 70, active: true },
];

test("Italian VML input sheet uses B technology, C wattage and D quantity", () => {
  const headers = applyOfficialInputSheetLayout("ProjectInputSheet_ITA", [
    "Column 1", "Column 2", "Column 3", "Column 4", "Column 5", "Column 6", "Column 7",
  ]);
  const mapping = guessLightingMapping(headers);
  assert.equal(mapping.technology, "1");
  assert.equal(mapping.wattage, "2");
  assert.equal(mapping.quantity, "3");
});

test("wattage values with W suffix are parsed", () => {
  assert.equal(parseWattageValue("150W"), 150);
  assert.equal(parseWattageValue("100 W"), 100);
  assert.equal(parseWattageValue("70,5W"), 70.5);
});

test("Riccardo-style Italian input rows import 45 luminaires", () => {
  const rows = [
    ["", "SAP", "150W", 35, "", "", "", "", 4200],
    ["", "LED", "100W", 10, "", "", "", "", 4200],
  ];
  const result = buildImportedGroups(
    rows,
    { technology: "1", wattage: "2", quantity: "3", name: "", assetId: "" },
    products,
    "it",
    "grouped",
  );

  assert.equal(result.totalQuantity, 45);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find(group => group.technology === "SAP")?.quantity, 35);
  assert.equal(result.groups.find(group => group.technology === "SAP")?.existingWattage, 150);
  assert.equal(result.groups.find(group => group.technology === "LED")?.quantity, 10);
  assert.equal(result.groups.find(group => group.technology === "LED")?.existingWattage, 100);
});
