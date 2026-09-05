import test from "node:test";
import assert from "node:assert/strict";
import { generateCatalogueVariants, mergeGeneratedVariants } from "./catalogueVariants.js";

test("generates ordinary LED variants with wattage CCT optics and controller", () => {
  const master = { id: "m1", model: "MANTA", brand: "VIMALUX", supplier: "UNILUMIN", productCategory: "STREET", costPrice: 50, salesPrice: 100 };
  let id = 0;
  const variants = generateCatalogueVariants(master, {
    baseCode: "MANTA",
    wattages: "20, 40",
    cctEfficiencies: "3000:155, 4000:165",
    optics: "L1, L2",
    controllers: "ZD",
    cri: 70,
  }, [], () => `v${++id}`);
  assert.equal(variants.length, 8);
  assert.equal(variants[0].model, "MANTA-20W-730-L1-ZD");
  assert.equal(variants[0].lumen, 3100);
  assert.equal(variants[0].supplier, "UNILUMIN");
  assert.equal(variants.find((item) => item.cct === 4000 && item.wattage === 40).lumen, 6600);
});

test("hybrid variants inherit one shared PV battery weight and mandatory MPPT data", () => {
  const master = { id: "h1", model: "ENBY-S", hybrid: true, pvWp: 45, batteryWh: 230, usableBatteryWh: 207, solarModeW: 40, weightKg: 12, mppt: true };
  const variants = generateCatalogueVariants(master, {
    baseCode: "ENBY-S",
    wattages: "20,60",
    cctEfficiencies: "3000:155",
    optics: "L1",
    controllers: "ZD",
  }, [], (() => { let id = 0; return () => `h${++id}`; })());
  assert.equal(variants.length, 2);
  for (const variant of variants) {
    assert.equal(variant.pvWp, 45);
    assert.equal(variant.batteryWh, 230);
    assert.equal(variant.solarModeW, 40);
    assert.equal(variant.weightKg, 12);
    assert.equal(variant.mppt, true);
  }
  assert.equal(variants[0].lumen, 3100);
  assert.equal(variants[1].lumen, 9300);
});

test("regeneration preserves existing variant IDs and manually changed prices", () => {
  const master = { id: "m1", model: "MANTA", costPrice: 50, salesPrice: 100 };
  const existing = [{ id: "stable-id", variantParentId: "m1", variantKey: "20|3000|L1|ZD", costPrice: 61, salesPrice: 122, active: true }];
  const variants = generateCatalogueVariants(master, { baseCode: "MANTA", wattages: "20", cctEfficiencies: "3000:155", optics: "L1", controllers: "ZD" }, existing, () => "new-id");
  assert.equal(variants[0].id, "stable-id");
  assert.equal(variants[0].costPrice, 61);
  assert.equal(variants[0].salesPrice, 122);
});

test("removed combinations are retained inactive instead of deleting historical Product IDs", () => {
  const master = { id: "m1" };
  const products = [master, { id: "old-20", variantParentId: "m1", variantKey: "20|3000|L1|ZD", active: true }, { id: "old-40", variantParentId: "m1", variantKey: "40|3000|L1|ZD", active: true }];
  const variants = [{ id: "old-20", variantParentId: "m1", variantKey: "20|3000|L1|ZD", active: true }];
  const merged = mergeGeneratedVariants(products, master, variants);
  const retired = merged.find((item) => item.id === "old-40");
  assert.ok(retired);
  assert.equal(retired.active, false);
  assert.equal(retired.variantRetired, true);
  assert.equal(merged.find((item) => item.id === "old-20").active, true);
});
