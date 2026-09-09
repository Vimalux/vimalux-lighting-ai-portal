import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Italy base CO2 factor and customer-report VAT semantics stay aligned", () => {
  const model = fs.readFileSync("src/model.js", "utf8");
  const proposal = fs.readFileSync("src/preliminaryProposalV2.js", "utf8");
  const cashflow = fs.readFileSync("src/proposalFinalVisualPages.js", "utf8");
  assert.match(model, /co2KgPerKwh:\s*\.1926/);
  assert.match(proposal, /Indicizzazione interna OPEX servizi/);
  assert.match(proposal, /canone cliente fisso/);
  assert.match(cashflow, /Cash flow economico netto IVA/);
  assert.match(cashflow, /Cash flow annuale netto IVA/);
});
