import test from "node:test";
import assert from "node:assert/strict";
import {
  compatibleLedProducts,
  isCatalogueProductCompatible,
  normalizeCatalogueProduct,
  normalizeProductCategory,
  normalizeReplacementStrategy,
} from "../src/productCatalogue.js";

test("Planner and Italian category labels normalize to shared codes", () => {
  assert.equal(normalizeProductCategory("Cobra Head"), "STREET");
  assert.equal(normalizeProductCategory("Proiettore"), "FLOODLIGHT");
  assert.equal(normalizeProductCategory("Lanterna"), "LANTERN");
  assert.equal(normalizeProductCategory("Retrofit Kit"), "RETROFIT_KIT");
  assert.equal(normalizeReplacementStrategy("Sostituzione completa"), "REPLACE");
  assert.equal(normalizeReplacementStrategy("Entrambe le opzioni"), "EITHER");
});

test("catalogue product gets Planner-compatible technical defaults", () => {
  const product = normalizeCatalogueProduct({ name: "MANTA 40", wattage: 40, lumen: 6400, productCategory: "Street" });
  assert.equal(product.model, "MANTA 40");
  assert.equal(product.productCategory, "STREET");
  assert.equal(product.efficiency, 160);
  assert.deepEqual(product.compatibleExistingCategories, []);
  assert.deepEqual(product.replacementStrategies, []);
});

test("lantern retrofit only matches compatible retrofit products", () => {
  const products = [
    { id: "street", active: true, productCategory: "STREET", compatibleExistingCategories: ["STREET"], replacementStrategies: ["REPLACE"] },
    { id: "lantern", active: true, productCategory: "LANTERN", compatibleExistingCategories: ["LANTERN"], replacementStrategies: ["REPLACE"] },
    { id: "retro", active: true, productCategory: "RETROFIT_KIT", compatibleExistingCategories: ["LANTERN"], replacementStrategies: ["RETROFIT"] },
  ];
  assert.deepEqual(compatibleLedProducts(products, "LANTERN", "RETROFIT").map((item) => item.id), ["retro"]);
  assert.equal(isCatalogueProductCompatible(products[1], "LANTERN", "REPLACE"), true);
  assert.equal(isCatalogueProductCompatible(products[1], "LANTERN", "RETROFIT"), false);
});

test("legacy products without new metadata remain available during migration", () => {
  const legacy = { id: "legacy", active: true, name: "Old catalogue row" };
  assert.equal(isCatalogueProductCompatible(legacy, "LANTERN", "RETROFIT"), true);
});
