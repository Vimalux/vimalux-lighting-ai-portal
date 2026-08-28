import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalogueProduct } from "./productCatalogue.js";

test("catalogue keeps CCT/CRI performance code as a distinct product attribute", () => {
  const product = normalizeCatalogueProduct({
    id: "VML-MANTA-40-740",
    model: "MANTA-STC3-4-040-740",
    wattage: 40,
    lumen: 7200,
    cctCriCode: "740",
  });
  assert.equal(product.cctCriCode, "740");
  assert.equal(product.efficiency, 180);
});

test("legacy CCT and CRI fields are retained without inventing a CCT/CRI code", () => {
  const product = normalizeCatalogueProduct({ cct: "3000K", cri: ">=70" });
  assert.equal(product.cctCriCode, "");
  assert.equal(product.cct, "3000K");
  assert.equal(product.cri, ">=70");
});
