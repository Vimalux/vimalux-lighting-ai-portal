import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const proposal = fs.readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");
const capexPage = fs.readFileSync(new URL("../src/capexProposalPage.js", import.meta.url), "utf8");
const cashPage = fs.readFileSync(new URL("../src/proposalFinalVisualPages.js", import.meta.url), "utf8");
const vatCard = fs.readFileSync(new URL("../src/VatSettings.jsx", import.meta.url), "utf8");

test("LaaS proposal uses all-inclusive payment semantics and non-indexed TCV wording", () => {
  assert.match(proposal, /Canone annuale LaaS \/ Noleggio tutto incluso/);
  assert.match(proposal, /Canone mensile LaaS \/ Noleggio tutto incluso/);
  assert.match(proposal, /OPEX servizi \/ mese \(incluso nel canone\)/);
  assert.doesNotMatch(proposal, /TCV \$\{contractYears\} anni, indicizzato/);
});

test("zero-Hybrid CAPEX page switches to LED-only wording", () => {
  assert.match(capexPage, /hasHybrid \? "Apparecchi LED \/ Hybrid" : "Apparecchi LED"/);
  assert.match(capexPage, /apparecchi LED standard/);
});

test("LaaS cash-flow labels canone and included OPEX explicitly", () => {
  assert.match(cashPage, /Canone LaaS \/ Noleggio/);
  assert.match(cashPage, /OPEX servizi \(incluso\)/);
});

test("VAT card is deal-type aware", () => {
  assert.match(vatCard, /dealType === "noleggio_operativo"/);
  assert.match(vatCard, /Canone mensile lordo cliente/);
  assert.match(vatCard, /Rata mensile finanziamento CAPEX/);
});
