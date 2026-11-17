import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { preliminaryButtonCopy, preliminaryProposalMissing, preliminaryProposalNarrative, preliminaryProposalT } from "../src/preliminaryProposalCopy.js";
import { commercialReleaseLabel } from "../src/commercialApproval.js";
import { reportMoney, reportNumber } from "../src/reportPresentation.js";

const generator = readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");
const panel = readFileSync(new URL("../src/CommercialApprovalPanel.jsx", import.meta.url), "utf8");

test("Spanish and Danish preliminary proposal PDF cover every existing static bilingual customer label", () => {
  const englishLabels = [...generator.matchAll(/it \? "[^"]*" : "([^"]*)"/g)].map((match) => match[1]);
  assert.ok(englishLabels.length >= 70, "checks all existing proposal sections and table labels");
  for (const locale of ["es", "da"]) {
    assert.deepEqual(preliminaryProposalMissing(locale, englishLabels), [], `Missing ${locale} proposal labels`);
  }
  assert.match(generator, /const lang = \["it", "en", "es", "da"\]/);
  assert.match(generator, /const proposalTable =/);
  assert.match(generator, /head: localRows\(options\.head\), body: localRows\(options\.body\)/);
  assert.match(generator, /const write = .*pdfSafeText\(local\(value\)\)/);
});

test("Spanish preliminary proposal translates dynamic financial terms, units and legal caveats", () => {
  assert.equal(preliminaryProposalT("es", "Preliminary Smart Lighting Proposal"), "Propuesta preliminar de alumbrado inteligente");
  assert.equal(preliminaryProposalT("es", "Customer cash-out TCV 10 years"), "TCV de pagos del cliente en 10 años");
  assert.equal(preliminaryProposalT("es", "3871 Smart lighting points"), "3871 puntos de luz Smart");
  assert.equal(preliminaryProposalT("es", "Municipality-benefit NPV (10 years)"), "VAN del beneficio municipal (10 años)");
  assert.match(preliminaryProposalNarrative("es", "intro", { projectName: "Vinto", code: "BC-099533", solution: "alumbrado LED" }), /Vinto.*BC-099533.*alumbrado LED/);
  assert.match(preliminaryProposalNarrative("es", "disclaimer", { project: { customer: { customerType: "municipality" } } }), /no constituye una oferta vinculante.*autorización comercial de VIMALUX/);
  assert.match(preliminaryProposalNarrative("es", "disclaimer", { project: {} }), /IVA recuperable/);
  assert.equal(preliminaryButtonCopy.es.create, "Generar propuesta preliminar (no vinculante)");
  assert.equal(commercialReleaseLabel("approved_by_policy", "es"), "Oferta definitiva admisible conforme a los criterios de VIMALUX");
});

test("Danish proposal and commercial approval UI follow selected language without changing approval authority", () => {
  assert.equal(preliminaryProposalT("da", "Monthly CAPEX financing payment"), "Månedlig CAPEX-finansiering");
  assert.match(preliminaryProposalNarrative("da", "disclaimer", { project: {} }), /ikke et endeligt bindende tilbud.*VIMALUX/);
  assert.match(preliminaryButtonCopy.da.create, /ikke bindende/);
  assert.match(panel, /ui\("title"\)/);
  assert.match(panel, /ui\("admin"\)/);
  assert.match(panel, /ui\("assessment", result\.decisionStatus/);
  assert.match(generator, /proposal_status: "draft"/);
});

test("financial figures in Spanish and Danish proposals use local separators and euro placement", () => {
  assert.equal(reportNumber(1099141.55, 2, "es"), "1.099.141,55");
  assert.equal(reportNumber(1099141.55, 2, "da"), "1.099.141,55");
  assert.equal(reportMoney(1099141, "es"), "1.099.141 €");
  assert.equal(reportMoney(1099141, "da"), "1.099.141 €");
  assert.equal(reportMoney(1099141, "en"), "€1,099,141");
  assert.equal(reportMoney(1099141, "it"), "1.099.141 €");
});
