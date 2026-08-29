import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const visualSource = fs.readFileSync(new URL("../src/proposalVisualPages.js", import.meta.url), "utf8");
const autoSource = fs.readFileSync(new URL("../src/proposalVisualAuto.js", import.meta.url), "utf8");

test("proposal page 3 uses dashboard-style cost evolution instead of duplicate mini bar sections", () => {
  assert.match(visualSource, /Evoluzione dei costi e dei risparmi/);
  assert.match(visualSource, /costEvolutionChart\(/);
  assert.match(visualSource, /currentOperatingCost/);
  assert.match(visualSource, /futureOperatingCost/);
  assert.match(visualSource, /servicePayment/);
  assert.match(visualSource, /investmentPayment/);
  assert.match(visualSource, /customerSaving/);
  assert.doesNotMatch(visualSource, /Costo energetico annuo/);
  assert.doesNotMatch(visualSource, /Composizione beneficio annuo/);
});

test("proposal keeps cashflow as page 4 and final four-page footer redraw", () => {
  assert.match(visualSource, /Cash flow cliente/);
  assert.match(visualSource, /year: 0/);
  assert.match(autoSource, /redrawFourPageFooters/);
  assert.match(autoSource, /doc\.rect\(0, 278, 210, 19, "F"\)/);
});
