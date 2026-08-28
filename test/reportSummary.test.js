import test from "node:test";
import assert from "node:assert/strict";
import { aggregateReplacementRows } from "../src/reportSummary.js";

test("report combines identical replacement lines while retaining different source wattages", () => {
  const product = { id: "led-40", name: "VIMA LED 40", wattage: 40 };
  const rows = aggregateReplacementRows([
    { technology: "SAP / HPS", existingWattage: 70, quantity: 1, product },
    { technology: "SAP / HPS", existingWattage: 70, quantity: 5, product },
    { technology: "SAP / HPS", existingWattage: 100, quantity: 2, product },
  ]);
  assert.deepEqual(rows, [
    { technology: "SAP / HPS", existingWattage: 70, quantity: 6, productName: "VIMA LED 40", configuredLedWattage: 40 },
    { technology: "SAP / HPS", existingWattage: 100, quantity: 2, productName: "VIMA LED 40", configuredLedWattage: 40 },
  ]);
});

test("report keeps identical products at different configured wattages separate", () => {
  const product = { id: "led-20", name: "MAKO 20", wattage: 20 };
  const rows = aggregateReplacementRows([
    { technology: "OTHER", existingWattage: 29, quantity: 10, product, configuredLedWattage: 17 },
    { technology: "OTHER", existingWattage: 29, quantity: 5, product, configuredLedWattage: 20 },
  ]);
  assert.equal(rows.length, 2);
});

test("report keeps different proposed products on separate summary lines", () => {
  const rows = aggregateReplacementRows([
    { technology: "SAP / HPS", existingWattage: 70, quantity: 3, product: { id: "a", name: "LED A" } },
    { technology: "SAP / HPS", existingWattage: 70, quantity: 4, product: { id: "b", name: "LED B" } },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((sum, row) => sum + row.quantity, 0), 7);
});
