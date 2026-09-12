import test from "node:test";
import assert from "node:assert/strict";
import { buildProcurementRows, groupProcurementBySupplier } from "../src/procurement.js";

const baseProject = () => ({
  language: "it",
  project: { name: "Poggiardo", businessCaseId: "BC-TEST" },
  groups: [
    { id: "g1", quantity: 10, upgradeSelected: true, proposedProductId: "led-1" },
  ],
  catalogue: {
    led: [
      { id: "led-1", brand: "VIMALUX", model: "MANTA 40W", supplier: "LED SUPPLIER", supplierSku: "MANTA-40", costPrice: 80 },
    ],
    smart: [
      { id: "felicity-lcu", brand: "FELICITY", name: "PowerAiD LCU", type: "LCU", cmsPartner: "FELICITY", supplier: "FELICITY", supplierSku: "FEL-LCU", costPrice: 25, active: true },
      { id: "felicity-gw", brand: "FELICITY", name: "Cabinet Gateway", type: "Gateway", cmsPartner: "FELICITY", supplier: "FELICITY", supplierSku: "FEL-GW", costPrice: 300, active: true },
    ],
  },
  solution: {
    smartEnabled: true,
    cmsEnabled: true,
    cmsPartner: "FELICITY",
    lcuProductId: "felicity-lcu",
    gatewayProductId: "felicity-gw",
    gatewayQuantity: 2,
    antennaProductId: "",
    antennaQuantity: 0,
    meterProductId: "",
    meterQuantity: 0,
  },
  additionalCosts: [],
});

test("selected FELICITY smart products become FELICITY procurement lines", () => {
  const rows = buildProcurementRows(baseProject());
  const felicity = rows.filter((row) => row.supplier === "FELICITY");
  assert.equal(felicity.length, 2);
  assert.deepEqual(felicity.map((row) => [row.source, row.quantity, row.supplierSku]), [
    ["LCU", 10, "FEL-LCU"],
    ["Gateway", 2, "FEL-GW"],
  ]);
});

test("supplier grouping creates a dedicated FELICITY partner order group", () => {
  const groups = groupProcurementBySupplier(baseProject());
  const felicity = groups.find((group) => group.supplier === "FELICITY");
  assert.ok(felicity);
  assert.equal(felicity.assigned, true);
  assert.equal(felicity.items.length, 2);
  assert.equal(felicity.totalCost, 10 * 25 + 2 * 300);
});

test("existing LED procurement remains separate and unchanged", () => {
  const groups = groupProcurementBySupplier(baseProject());
  const led = groups.find((group) => group.supplier === "LED SUPPLIER");
  assert.ok(led);
  assert.equal(led.items.length, 1);
  assert.equal(led.items[0].description, "MANTA 40W");
  assert.equal(led.items[0].quantity, 10);
});
