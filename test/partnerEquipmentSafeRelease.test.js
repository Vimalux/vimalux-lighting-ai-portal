import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { groupProcurementBySupplier } from "../src/procurement.js";
import { availablePartnerEquipment, partnerEquipmentAdditionalCosts, partnerEquipmentPricingRows } from "../src/partnerEquipment.js";

function projectWithFelicityEquipment() {
  const project = defaultProject({ applyStoredDefaults: false });
  project.catalogue.smart.push({
    id: "felicity-camera",
    name: "1xCAM AC LTE NEMA",
    type: "Other",
    brand: "VIMALUX",
    supplier: "FELICITY",
    supplierSku: "FSI-HIVE_LTE-AC-1U-N",
    costPrice: 1000,
    salesPrice: 2000,
    implementationCost: 6,
    implementationSalesPrice: 6,
    annualCost: 0,
    annualSalesPrice: 0,
    active: true,
  });
  project.solution.cmsPartner = "FELICITY";
  project.solution.partnerEquipment = [{ id: "sel-1", productId: "felicity-camera", quantity: 2 }];
  return project;
}

test("FELICITY Other products are selectable as partner equipment without reclassifying them as LCU", () => {
  const project = projectWithFelicityEquipment();
  const options = availablePartnerEquipment(project, "FELICITY");
  assert.equal(options.length, 1);
  assert.equal(options[0].id, "felicity-camera");
  assert.equal(options[0].type, "Other");
});

test("selected FELICITY partner equipment creates one dedicated supplier order line", () => {
  const groups = groupProcurementBySupplier(projectWithFelicityEquipment());
  const felicity = groups.find((group) => group.supplier === "FELICITY");
  assert.ok(felicity);
  const camera = felicity.items.find((item) => item.productId === "felicity-camera");
  assert.ok(camera);
  assert.equal(camera.quantity, 2);
  assert.equal(camera.supplierSku, "FSI-HIVE_LTE-AC-1U-N");
  assert.equal(camera.source, "Partner Equipment");
});

test("partner equipment is converted to calculation-only CAPEX and leaves stored Additional Costs untouched", () => {
  const project = projectWithFelicityEquipment();
  const before = structuredClone(project.additionalCosts);
  const virtual = partnerEquipmentAdditionalCosts(project);
  assert.equal(virtual.length, 1);
  assert.equal(virtual[0].costType, "capex");
  assert.equal(virtual[0].unitCost, 1006);
  assert.equal(virtual[0].unitSalesPrice, 2006);
  calculateBusinessCase(project);
  assert.deepEqual(project.additionalCosts, before);
});

test("partner equipment CAPEX flows through the existing calculation engine exactly once", () => {
  const withEquipment = projectWithFelicityEquipment();
  const withoutEquipment = structuredClone(withEquipment);
  withoutEquipment.solution.partnerEquipment = [];
  const base = calculateBusinessCase(withoutEquipment);
  const result = calculateBusinessCase(withEquipment);
  assert.equal(result.totalCapex - base.totalCapex, 2 * 2006);
  assert.equal(result.capexDirectCost - base.capexDirectCost, 2 * 1006);
});

test("selected partner equipment exposes dynamic project-pricing rows for hardware and implementation", () => {
  const rows = partnerEquipmentPricingRows(projectWithFelicityEquipment());
  assert.equal(rows.length, 2);
  const hardware = rows.find((row) => row.key === "salesPrice");
  const implementation = rows.find((row) => row.key === "implementationSalesPrice");
  assert.ok(hardware);
  assert.ok(implementation);
  assert.equal(hardware.q, 2);
  assert.equal(hardware.cat, 2000);
  assert.equal(hardware.cost, 1000);
  assert.equal(hardware.total, 4000);
  assert.match(hardware.label, /FELICITY/);
  assert.match(hardware.label, /FSI-HIVE_LTE-AC-1U-N/);
  assert.equal(implementation.total, 12);
});

test("project price overrides change partner-equipment economics without changing catalogue master data", () => {
  const project = projectWithFelicityEquipment();
  const before = structuredClone(project.catalogue.smart.find((item) => item.id === "felicity-camera"));
  const base = calculateBusinessCase(project);
  project.pricing.overrides["felicity-camera"] = {
    salesPrice: 1750,
    implementationSalesPrice: 4,
  };
  const rows = partnerEquipmentPricingRows(project);
  assert.equal(rows.find((row) => row.key === "salesPrice").total, 3500);
  assert.equal(rows.find((row) => row.key === "implementationSalesPrice").total, 8);
  const overridden = calculateBusinessCase(project);
  assert.equal(overridden.totalCapex - base.totalCapex, 2 * ((1750 + 4) - (2000 + 6)));
  assert.deepEqual(project.catalogue.smart.find((item) => item.id === "felicity-camera"), before);
});
