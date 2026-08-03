import test from "node:test";
import assert from "node:assert/strict";
import { buildImportedGroups, guessLightingMapping, normalizeTechnology } from "../src/lightingImport.js";

test("column mapping recognises common lighting headers", () => {
  assert.deepEqual(guessLightingMapping(["Street", "Lamp Type", "Wattage", "Quantity"]), { technology: "1", wattage: "2", quantity: "3", name: "0" });
});

test("technology names are normalised", () => {
  assert.equal(normalizeTechnology("Sodium HPS"), "SAP");
  assert.equal(normalizeTechnology("Metal Halide"), "MH");
  assert.equal(normalizeTechnology("HQL Mercury"), "MERCURY");
  assert.equal(normalizeTechnology("Existing LED"), "LED");
});

test("individual rows aggregate into wattage and technology groups", () => {
  const rows = [["HPS", 70], ["SAP", 70], ["HQL", 125], ["HQL", 0]];
  const result = buildImportedGroups(rows, { technology: "0", wattage: "1", quantity: "", name: "" }, [{ id: "led-1", active: true }], "en");
  assert.equal(result.totalQuantity, 3);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups.find((group) => group.technology === "SAP").quantity, 2);
  assert.equal(result.skipped, 1);
});

test("an optional quantity column imports already summarised sheets", () => {
  const result = buildImportedGroups([["LED", "100", "357"]], { technology: "0", wattage: "1", quantity: "2", name: "" }, [{ id: "led-1", active: true }], "en");
  assert.equal(result.totalQuantity, 357);
});
