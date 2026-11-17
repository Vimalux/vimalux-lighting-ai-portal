import assert from "node:assert/strict";
import test from "node:test";
import { qualityGateMessage, qualityWarningMessage } from "../src/proposalQuality.js";

test("proposal validation and warnings use the selected interface language", () => {
  const blocked = { blockers: [{ group: "A", category: "STREET", productId: "" }] };
  const warning = { warnings: [{ group: "B", category: "URBAN", productId: "P1" }] };
  assert.match(qualityGateMessage(blocked, "es"), /Propuesta bloqueada.*sin producto/);
  assert.match(qualityGateMessage(blocked, "da"), /Tilbud blokeret.*intet produkt/);
  assert.match(qualityGateMessage(blocked, "it"), /Proposta bloccata.*nessun prodotto/);
  assert.match(qualityGateMessage(blocked, "en"), /Proposal blocked.*no product/);
  assert.match(qualityWarningMessage(warning, "es"), /^Advertencia técnica:/);
  assert.match(qualityWarningMessage(warning, "da"), /^Teknisk advarsel:/);
});
