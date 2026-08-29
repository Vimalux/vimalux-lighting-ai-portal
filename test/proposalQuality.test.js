import test from "node:test";
import assert from "node:assert/strict";
import { validateProposalQuality } from "../src/proposalQuality.js";

const product = (id, productCategory, compatibleExistingCategories) => ({ id, productCategory, compatibleExistingCategories });

const base = {
  catalogue: { led: [
    product("MANTA", "STREET", ["STREET"]),
    product("OPERA", "URBAN", ["URBAN", "GLOBO"]),
    product("FLOLY", "FLOODLIGHT", ["FLOODLIGHT"]),
    product("RETRO", "RETROFIT_KIT", ["STREET", "URBAN"]),
  ] },
};

test("accepts explicit cross-category compatibility", () => {
  const project = { ...base, groups: [{ name: "Urban retrofit", quantity: 10, existingCategory: "URBAN", proposedProductId: "RETRO" }] };
  assert.equal(validateProposalQuality(project).ok, true);
});

test("blocks STREET product on URBAN group", () => {
  const project = { ...base, groups: [{ name: "Urban", quantity: 10, existingCategory: "URBAN", proposedProductId: "MANTA" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].type, "incompatible_product");
});

test("blocks URBAN product on FLOODLIGHT group", () => {
  const project = { ...base, groups: [{ name: "Projector", quantity: 4, existingCategory: "FLOODLIGHT", proposedProductId: "OPERA" }] };
  assert.equal(validateProposalQuality(project).ok, false);
});

test("accepts FLOODLIGHT product on FLOODLIGHT group", () => {
  const project = { ...base, groups: [{ name: "Projector", quantity: 4, existingCategory: "Proiettore", proposedProductId: "FLOLY" }] };
  assert.equal(validateProposalQuality(project).ok, true);
});
