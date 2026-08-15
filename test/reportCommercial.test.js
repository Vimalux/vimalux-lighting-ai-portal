
import test from "node:test";
import assert from "node:assert/strict";
import { reportCommercialContext } from "../src/reportCommercial.js";

const project = (dealType, language = "it", financingModel = "cash") => ({
  language,
  assumptions: { dealType, financingModel },
});

test("PDF project type follows the calculated deal type, not the legacy financing field", () => {
  const context = reportCommercialContext(project("noleggio_operativo"), { dealType: "noleggio_operativo" });
  assert.equal(context.projectType, "Noleggio Operativo");
  assert.equal(context.financed, true);
});

test("Noleggio report states that OPEX is included in the all-inclusive payment", () => {
  const context = reportCommercialContext(project("noleggio_operativo"), { dealType: "noleggio_operativo" });
  assert.equal(context.opexIncludedInPayment, true);
  assert.match(context.annualNetFootnote, /OPEX incluso/);
});

test("Cash report remains a Cash Deal with separately deducted OPEX", () => {
  const context = reportCommercialContext(project("cash", "en", "laas"), { dealType: "cash" });
  assert.equal(context.projectType, "Cash Deal");
  assert.equal(context.financed, false);
  assert.equal(context.opexIncludedInPayment, false);
  assert.match(context.annualNetFootnote, /annual OPEX/);
});
