import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { vatDefaultForCustomerType, normalizeCustomerVatType } from "../src/customerVatProfile.js";

test("customer type only supplies safe VAT defaults", () => {
  assert.deepEqual(vatDefaultForCustomerType("municipality"), { mode: "non_deductible", recoverablePercent: 0 });
  assert.deepEqual(vatDefaultForCustomerType("esco_company"), { mode: "deductible", recoverablePercent: 100 });
  assert.equal(vatDefaultForCustomerType("other"), null);
  assert.equal(vatDefaultForCustomerType("unspecified"), null);
  assert.equal(normalizeCustomerVatType("unknown"), "unspecified");
});

test("VAT UI keeps recoverability manually editable and stores customer type", () => {
  const source = fs.readFileSync(new URL("../src/VatSettings.jsx", import.meta.url), "utf8");
  assert.match(source, /IVA recuperabile dal cliente/);
  assert.match(source, /customerType/);
  assert.match(source, /vatRecoverability/);
  assert.match(source, /Parziale \/ manuale/);
  assert.match(source, /resta sempre modificabile manualmente/);
});
