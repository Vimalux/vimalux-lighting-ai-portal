import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultProject } from "./model.js";
import { calculateBusinessCase } from "./calculations.js";
import { partnerEquipmentPricingRows } from "./partnerEquipment.js";
import { buildCustomerCapexDetail } from "./customerCapexDetail.js";

function felicityProject() {
  const project = defaultProject();
  project.solution.powerAidEnabled = true;
  project.catalogue.smart.push(
    {
      id: "felicity-camera",
      name: "1xCAM, DC powered, 4G LTE Modem",
      brand: "FELICITY",
      supplier: "FELICITY",
      supplierSku: "FSI-HIVE_LTE-DC-1U",
      type: "Other",
      costPrice: 1000,
      salesPrice: 2000,
      implementationCost: 0,
      implementationSalesPrice: 6,
      annualCost: 0,
      annualSalesPrice: 0,
      active: true,
    },
    {
      id: "felicity-battery",
      name: "CAMERA SENSOR BETTERY",
      brand: "FELICITY",
      supplier: "FELICITY",
      supplierSku: "HIVE-BATTERY",
      type: "Other",
      costPrice: 400,
      salesPrice: 500,
      implementationCost: 0,
      implementationSalesPrice: 0,
      annualCost: 0,
      annualSalesPrice: 0,
      active: true,
    },
  );
  project.solution.partnerEquipment = [
    { id: "camera", partnerRole: "ADAPTIVE_DIMMING", productId: "felicity-camera", quantity: 1 },
    { id: "battery", partnerRole: "ADAPTIVE_DIMMING", productId: "felicity-battery", quantity: 1 },
  ];
  return project;
}

test("Felicity equipment is included in CAPEX and itemized at catalogue sales prices", () => {
  const project = felicityProject();
  const withoutEquipment = calculateBusinessCase({
    ...project,
    solution: { ...project.solution, partnerEquipment: [] },
  });
  const result = calculateBusinessCase(project);
  const pricingRows = partnerEquipmentPricingRows(project).filter((row) => row.costType === "capex");

  assert.equal(pricingRows.reduce((sum, row) => sum + row.total, 0), 2506);
  assert.equal(result.additionalCapexSales, 2506);
  assert.equal(result.totalCapex - withoutEquipment.totalCapex, 2506);

  const detail = buildCustomerCapexDetail(project, result);
  const felicityRows = detail.components.filter((row) => row.category === "partner_equipment");
  assert.equal(felicityRows.reduce((sum, row) => sum + row.total, 0), 2506);
  assert.equal(detail.reconciles, true);
});

test("customer PDF uses calculated partner-equipment rows for its CAPEX/OPEX detail", () => {
  const source = readFileSync(new URL("./report.js", import.meta.url), "utf8");
  assert.match(source, /result\.additionalCosts\?\.rows \|\| project\.additionalCosts/);
  assert.match(source, /selectedPartnerEquipment\(project\)/);
});
