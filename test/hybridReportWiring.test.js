import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hybridReportDashboardModel } from "../src/reportHybridRuntime.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("preliminary PDF uses one final reconciled visual-page generator", () => {
  const source = read("src/proposalVisualAuto.js");
  assert.match(source, /appendFinalProposalVisualPages/);
  assert.doesNotMatch(source, /appendProposalVisualPages/);
  assert.doesNotMatch(source, /costEvolutionPage = this\.getNumberOfPages\(\) \+ 1/);
  const finalPages = read("src/proposalFinalVisualPages.js");
  assert.match(finalPages, /doc\.addPage\(\);[\s\S]*repairCostEvolutionProposalPage/);
  assert.match(finalPages, /isCashDeal/);
  assert.match(finalPages, /if \(isCashDeal\)/);
  assert.match(finalPages, /else \{[\s\S]*lineChart/);
});

test("report dashboard runtime is loaded without changing App permissions or workflows", () => {
  const main = read("src/main.jsx");
  assert.match(main, /reportHybridRuntime\.js/);
  assert.match(main, /reportLayoutFinalizerRuntime\.js/);
  const runtime = read("src/reportHybridRuntime.js");
  assert.match(runtime, /report-preview/);
  assert.match(runtime, /buildYearOneCustomerValuePhases/);
  assert.doesNotMatch(runtime, /supabase\.auth|currentProfile|agentAllowedViews|pricing/);
  const finalizer = read("src/reportLayoutFinalizerRuntime.js");
  assert.match(finalizer, /customer-value-chart/);
  assert.match(finalizer, /data-vimalux-report-hybrid/);
  assert.doesNotMatch(finalizer, /supabase\.auth|currentProfile|agentAllowedViews|pricing|catalogue/);
});

test("Hybrid report dashboard model exposes the Business Case grid offset and benefit", () => {
  const model = hybridReportDashboardModel(
    { language: "it", project: { currency: "EUR" } },
    {
      hybridEligibleGridKwh: 5000,
      hybridSolarSavingKwh: 4302,
      hybridSolarSavingEUR: 1248,
      hybridSolar: {
        enabled: true,
        totalHybridUnits: 82,
        totalPvKwh: 4991,
        totalContributionPercent: 80,
        rows: [{ quantity: 82, pvWp: 45 }],
        location: { municipality: "Poggiardo", source: "PVGIS" },
      },
    },
  );
  assert.equal(model.units, 82);
  assert.equal(model.installedPvKwp, 3.69);
  assert.equal(model.gridOffsetKwh, 4302);
  assert.equal(model.benefitEur, 1248);
  assert.equal(model.location, "Poggiardo");
});
