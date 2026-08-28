import test from "node:test";
import assert from "node:assert/strict";
import {
  compatibleLedProducts,
  inferProductCategory,
  isCatalogueProductCompatible,
  normalizeCatalogueProduct,
  normalizeProductCategory,
  normalizeReplacementStrategy,
} from "../src/productCatalogue.js";

test("Planner and Italian category labels normalize to shared codes", () => {
  assert.equal(normalizeProductCategory("Cobra Head"), "STREET");
  assert.equal(normalizeProductCategory("Arredo urbano"), "URBAN");
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

test("legacy VIMALUX family names infer the correct luminaire category", () => {
  assert.equal(inferProductCategory({ model: "VML-MANTA-STC3-1-030" }), "STREET");
  assert.equal(inferProductCategory({ model: "VML-OPERA-PT-40-730-ZU" }), "URBAN");
  assert.equal(inferProductCategory({ model: "VML-RETRO-A-40-730-ZU" }), "URBAN");
  assert.equal(inferProductCategory({ model: "VML-FL01-60" }), "FLOODLIGHT");
});

test("urban rows cannot recommend street families solely because wattage is closer", () => {
  const products = [
    { id: "manta-20", active: true, model: "VML-MANTA-STC3-1-020", wattage: 20 },
    { id: "opera-30", active: true, model: "VML-OPERA-PT-30-730-ZU", wattage: 30 },
    { id: "retro-40", active: true, model: "VML-RETRO-A-40-730-ZU", wattage: 40 },
  ];
  assert.deepEqual(
    compatibleLedProducts(products, "ARREDO URBANO", "UNKNOWN").map((item) => item.id),
    ["opera-30", "retro-40"],
  );
});

test("street rows stay within street luminaire families", () => {
  const products = [
    { id: "manta-30", active: true, model: "VML-MANTA-STC3-1-030", wattage: 30 },
    { id: "opera-30", active: true, model: "VML-OPERA-PT-30-730-ZU", wattage: 30 },
  ];
  assert.deepEqual(compatibleLedProducts(products, "STREET", "UNKNOWN").map((item) => item.id), ["manta-30"]);
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

test("truly unknown legacy products remain available during migration", () => {
  const legacy = { id: "legacy", active: true, name: "Old catalogue row" };
  assert.equal(isCatalogueProductCompatible(legacy, "LANTERN", "RETROFIT"), true);
});
