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
  const result = validateProposalQuality(project);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 0);
});

test("warns but does not block STREET product on URBAN group", () => {
  const project = { ...base, groups: [{ name: "Urban", quantity: 10, existingCategory: "URBAN", proposedProductId: "MANTA" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].type, "incompatible_product");
});

test("warns but does not block URBAN product on FLOODLIGHT group", () => {
  const project = { ...base, groups: [{ name: "Projector", quantity: 4, existingCategory: "FLOODLIGHT", proposedProductId: "OPERA" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
});

test("accepts FLOODLIGHT product on FLOODLIGHT group", () => {
  const project = { ...base, groups: [{ name: "Projector", quantity: 4, existingCategory: "Proiettore", proposedProductId: "FLOLY" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 0);
});

test("still blocks an upgraded group with no proposed product", () => {
  const project = { ...base, groups: [{ name: "Missing", quantity: 4, existingCategory: "STREET", proposedProductId: "" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, false);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].type, "missing_product");
});

test("still blocks an unknown catalogue product id", () => {
  const project = { ...base, groups: [{ name: "Unknown", quantity: 4, existingCategory: "STREET", proposedProductId: "DOES_NOT_EXIST" }] };
  const result = validateProposalQuality(project);
  assert.equal(result.ok, false);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].type, "unknown_product");
});
