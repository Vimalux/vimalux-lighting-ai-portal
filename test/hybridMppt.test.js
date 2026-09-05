import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalogueProduct } from "../src/productCatalogue.js";

test("hybrid luminaires always normalize with MPPT enabled", () => {
  const product = normalizeCatalogueProduct({ hybrid: true, mppt: false, wattage: 40, lumen: 6400 });
  assert.equal(product.hybrid, true);
  assert.equal(product.mppt, true);
});

test("non-hybrid luminaires preserve their MPPT flag", () => {
  assert.equal(normalizeCatalogueProduct({ hybrid: false, mppt: false }).mppt, false);
  assert.equal(normalizeCatalogueProduct({ hybrid: false, mppt: true }).mppt, true);
});
