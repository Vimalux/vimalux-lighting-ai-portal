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

test("preliminary PDF repairs cost evolution after visual pages are generated", () => {
  const source = read("src/proposalVisualAuto.js");
  assert.match(source, /repairCostEvolutionProposalPage/);
  assert.match(source, /costEvolutionPage = this\.getNumberOfPages\(\) \+ 1/);
  assert.match(source, /repairCostEvolutionProposalPage\(this, project, calculated, costEvolutionPage/);
});

test("report dashboard runtime is loaded without changing App permissions or workflows", () => {
  const main = read("src/main.jsx");
  assert.match(main, /reportHybridRuntime\.js/);
  const runtime = read("src/reportHybridRuntime.js");
  assert.match(runtime, /report-preview/);
  assert.match(runtime, /buildYearOneCustomerValuePhases/);
  assert.doesNotMatch(runtime, /supabase\.auth|currentProfile|agentAllowedViews|pricing/);
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
