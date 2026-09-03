import test from "node:test";
import assert from "node:assert/strict";
import { buildProcurementRows, groupProcurementBySupplier } from "../src/procurement.js";

test("procurement groups selected LED, smart hardware and project costs without changing project data", () => {
  const project = {
    language: "it",
    project: { name: "Poggiardo", businessCaseId: "BC-P" },
    groups: [
      { id: "g1", quantity: 10, proposedProductId: "led-40", upgradeSelected: true },
      { id: "g2", quantity: 5, proposedProductId: "led-40", upgradeSelected: false },
    ],
    solution: { smartEnabled: true, lcuProductId: "lcu", gatewayProductId: "gw", gatewayQuantity: 1, antennaProductId: "", antennaQuantity: 0, meterProductId: "", meterQuantity: 0 },
    catalogue: {
      led: [{ id: "led-40", brand: "VIMALUX", supplier: "Lamp Supplier", supplierSku: "L40", model: "MANTA 40", costPrice: 50 }],
      smart: [{ id: "lcu", supplier: "DATEK", name: "LCU", costPrice: 20 }, { id: "gw", supplier: "DATEK", name: "Gateway", costPrice: 100 }],
    },
    additionalCosts: [{ id: "install", description: "Installation", category: "lavoro", quantity: 10, unit: "pz", unitCost: 35 }],
  };
  const before = structuredClone(project);
  const rows = buildProcurementRows(project);
  assert.equal(rows.find((row) => row.description === "MANTA 40")?.quantity, 10);
  assert.equal(rows.find((row) => row.description === "LCU")?.quantity, 10);
  assert.equal(rows.find((row) => row.description === "Gateway")?.quantity, 1);
  assert.equal(rows.find((row) => row.description === "Installation")?.supplier, "");
  assert.deepEqual(project, before);
});

test("project supplier assignment overrides catalogue supplier only inside procurement", () => {
  const project = {
    language: "it",
    groups: [{ quantity: 2, proposedProductId: "led-1", upgradeSelected: true }],
    catalogue: { led: [{ id: "led-1", supplier: "Default Supplier", model: "Lamp", costPrice: 10 }], smart: [] },
    solution: { smartEnabled: false },
    procurement: { assignments: { "led:led-1:0": "Project Supplier" } },
  };
  const groups = groupProcurementBySupplier(project);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].supplier, "Project Supplier");
  assert.equal(groups[0].totalCost, 20);
});

test("unassigned supplier remains visible instead of deleting procurement rows", () => {
  const project = { language: "it", groups: [], catalogue: { led: [], smart: [] }, solution: {}, additionalCosts: [{ id: "x", description: "Civil works", quantity: 1, unitCost: 500 }] };
  const groups = groupProcurementBySupplier(project);
  assert.equal(groups[0].supplier, "Fornitore non assegnato");
  assert.equal(groups[0].assigned, false);
});
