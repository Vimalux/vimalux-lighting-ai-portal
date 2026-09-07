import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transformProposalCustomerText } from "./proposalCustomerVatText.js";
import { customerVatDisclosure, vatRecoverablePercent } from "./customerVatProfile.js";

const esco = {
  language: "it",
  customer: { customerType: "esco_company" },
  assumptions: { vatRecoverability: "deductible", vatRecoverablePercent: 100 },
};

const municipality = {
  language: "it",
  customer: { customerType: "municipality" },
  assumptions: { vatRecoverability: "non_deductible", vatRecoverablePercent: 0 },
};

test("ESCO proposal language uses cliente / ESCO and 100% recoverable VAT", () => {
  assert.equal(transformProposalCustomerText("Beneficio netto annuo Comune", esco, "it"), "Beneficio netto annuo cliente / ESCO");
  assert.equal(transformProposalCustomerText("Cliente / Comune", esco, "it"), "Cliente / ESCO");
  assert.equal(transformProposalCustomerText("VAN beneficio Comune (20 anni)", esco, "it"), "VAN beneficio cliente / ESCO (20 anni)");
  assert.equal(
    transformProposalCustomerText("Scenario acquisto diretto: il CAPEX iniziale è sostenuto dal Comune.", esco, "it"),
    "Scenario acquisto diretto: il CAPEX iniziale è sostenuto dal cliente / ESCO.",
  );
  assert.equal(vatRecoverablePercent(esco), 100);
  assert.match(customerVatDisclosure(esco, "it"), /ESCO \/ impresa/);
  assert.match(customerVatDisclosure(esco, "it"), /100%/);
});

test("municipality proposal language remains municipality-specific", () => {
  assert.equal(transformProposalCustomerText("Beneficio netto annuo Comune", municipality, "it"), "Beneficio netto annuo Comune");
  assert.equal(transformProposalCustomerText("Cliente / Comune", municipality, "it"), "Cliente / Comune");
  assert.equal(vatRecoverablePercent(municipality), 0);
});

test("generic VAT disclaimer is replaced before PDF text is written", () => {
  const source = "Condizioni. IVA esclusa salvo diversa indicazione.";
  const transformed = transformProposalCustomerText(source, esco, "it");
  assert.doesNotMatch(transformed, /IVA esclusa salvo diversa indicazione/);
  assert.match(transformed, /IVA recuperabile dal cliente \/ ESCO: 100%/);
});

test("proposal customer VAT runtime is installed and project matching fails closed", () => {
  const main = fs.readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("./proposalCustomerVatTextRuntime.js", import.meta.url), "utf8");
  assert.match(main, /proposalCustomerVatTextRuntime\.js/);
  assert.match(runtime, /if \(!businessCaseRecordId\) return null/);
  assert.doesNotMatch(runtime, /projects\[0\]/);
});
