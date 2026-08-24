import test from "node:test";
import assert from "node:assert/strict";
import { mergeCatalogueProducts, parseCatalogueRows } from "./catalogueImport.js";

const header = [
  "Product ID *","Brand *","Product Family / Wattage Version *","Product Category *","Compatible Existing Categories *","Replacement Strategies *","Wattage (W) *","Lumens","Efficiency (lm/W)","CCT/CRI Code","IP","IK","CRI","Protection Class","Lifetime (h)","Zhaga Capable *","D4i Capable *","Photometry / Planner Reference","Tech Sheet / Certs URL","Cost Price (€) *","Standard Sales Price (€) *","Active *","Notes",
];

test("parses 740 performance variant with 180 lm/W", () => {
  const rows = [
    ["title"],
    header,
    ["VML-MANTA-40-740","VIMALUX","MANTA-STC3-1-040-740","STREET","STREET, URBAN","REPLACE",40,7200,180,"740","IP66","IK09",">=70","Class II",100000,"YES","YES","L1/L2/L3/L4","",60,120,"YES",""]
  ];
  const [product] = parseCatalogueRows(rows);
  assert.equal(product.id, "VML-MANTA-40-740");
  assert.equal(product.cctCriCode, "740");
  assert.equal(product.wattage, 40);
  assert.equal(product.lumen, 7200);
  assert.equal(product.efficiency, 180);
  assert.equal(product.zhaga, true);
  assert.equal(product.d4iDriver, true);
});

test("safe merge updates matching IDs, appends new IDs, retains missing existing IDs", () => {
  const existing = [
    { id: "A", model: "Old A", wattage: 20, salesPrice: 100, active: true },
    { id: "LEGACY", model: "Legacy", wattage: 30, salesPrice: 90, active: true },
  ];
  const imported = [
    { id: "A", model: "New A", wattage: 20, salesPrice: 110, active: true },
    { id: "B", model: "New B", wattage: 40, salesPrice: 130, active: true },
  ];
  const result = mergeCatalogueProducts(existing, imported);
  assert.equal(result.updated, 1);
  assert.equal(result.added, 1);
  assert.equal(result.retained, 1);
  assert.equal(result.products.length, 3);
  assert.equal(result.products.find((x) => x.id === "A").salesPrice, 110);
  assert.equal(result.products.find((x) => x.id === "LEGACY").model, "Legacy");
  assert.equal(result.products.find((x) => x.id === "B").model, "New B");
});

test("duplicate Product IDs are rejected", () => {
  const row = ["A","VIMALUX","A-40-730","STREET","STREET","REPLACE",40,6400,160,"730","IP66","IK09",">=70","Class II",100000,"YES","YES","","",50,100,"YES",""];
  assert.throws(() => parseCatalogueRows([header, row, row]), /duplicate Product ID A/);
});
