import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase } from "../src/calculations.js";
import { defaultProject } from "../src/model.js";
import { groupProcurementBySupplier } from "../src/procurement.js";
import { availablePartnerEquipment, partnerEquipmentAdditionalCosts } from "../src/partnerEquipment.js";

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
