import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mainSource = fs.readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const preliminarySource = fs.readFileSync(new URL("./preliminaryProposalV2.js", import.meta.url), "utf8");

test("PDF generation does not install the obsolete jsPDF text wrapper", () => {
  assert.equal(mainSource.includes("proposalCustomerVatTextRuntime.js"), false);
});

test("customer-aware proposal wording remains implemented in the PDF generator itself", () => {
  assert.match(preliminarySource, /transformProposalCustomerText/);
  assert.match(preliminarySource, /const customerText = \(value\) => transformProposalCustomerText/);
});
