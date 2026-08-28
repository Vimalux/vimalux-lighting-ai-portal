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

test("Italian VML v2.3 input sheet maps semantic headers independent of position", () => {
  const headers = applyOfficialInputSheetLayout("ProjectInputSheet_ITA", [
    "Localizzazione / gruppo *",
    "Categoria apparecchio *",
    "Wattaggio attuale (W) *",
    "Tecnologia attuale *",
    "N. apparecchi *",
    "Ore funzionamento annue *",
    "Modalità di sostituzione",
  ]);
  const mapping = guessLightingMapping(headers);
  assert.equal(mapping.name, "0");
  assert.equal(mapping.category, "1");
  assert.equal(mapping.wattage, "2");
  assert.equal(mapping.technology, "3");
  assert.equal(mapping.quantity, "4");
  assert.equal(mapping.operatingHours, "5");
  assert.equal(mapping.replacementRequirement, "6");
});

test("wattage values with W suffix are parsed", () => {
  assert.equal(parseWattageValue("150W"), 150);
  assert.equal(parseWattageValue("100 W"), 100);
  assert.equal(parseWattageValue("70,5W"), 70.5);
});

test("legacy Riccardo-style Italian rows still import 45 luminaires with explicit mapping", () => {
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
