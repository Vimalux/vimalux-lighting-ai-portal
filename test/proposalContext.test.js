import test from "node:test";
import assert from "node:assert/strict";
import { proposalProjectWithCatalogue } from "../src/proposalContext.js";
import { validateProposalQuality } from "../src/proposalQuality.js";

test("preliminary proposal hydrates canonical products before quality validation", () => {
  const row = { intelligence_data: { groups: [{ name: "Feletto A4", quantity: 12, existingCategory: "STREET", proposedProductId: "A4-40" }], catalogue: { led: [], smart: [] } } };
  const catalogue = { led: [{ id: "A4-40", productCategory: "STREET", active: true }], smart: [] };
  const project = proposalProjectWithCatalogue(row, catalogue);
  assert.equal(validateProposalQuality(project).ok, true);
});

test("historical selected products remain valid for an older Feletto version", () => {
  const historical = { id: "A4-LEGACY", productCategory: "STREET", active: true };
  const row = { intelligence_data: { groups: [{ name: "Feletto v/a4", quantity: 12, existingCategory: "STREET", proposedProductId: historical.id }], catalogue: { led: [historical], smart: [] } } };
  const project = proposalProjectWithCatalogue(row, { led: [], smart: [] });
  assert.equal(project.catalogue.led[0].historicalOnly, true);
  assert.equal(validateProposalQuality(project).ok, true);
});
