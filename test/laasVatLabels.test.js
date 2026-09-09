import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("LaaS report labels state that customer payments exclude VAT", () => {
  const proposal = fs.readFileSync("src/preliminaryProposalV2.js", "utf8");
  assert.match(proposal, /Canone annuale LaaS \/ Noleggio tutto incluso - netto IVA/);
  assert.match(proposal, /Canone mensile LaaS \/ Noleggio tutto incluso - netto IVA/);
  assert.match(proposal, /Annual all-inclusive LaaS \/ lease payment - excl\. VAT/);
  assert.match(proposal, /Monthly all-inclusive LaaS \/ lease payment - excl\. VAT/);
});
