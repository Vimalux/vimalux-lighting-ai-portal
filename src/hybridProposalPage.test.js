import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildHybridMonthlyReport } from "./hybridProposalPage.js";

test("Hybrid monthly report reconciles monthly grid offset to Business Case annual benefit", () => {
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
    pvKwh: 500 + index * 10,
    usableSolarKwh: 400,
    loadKwh: 600,
  }));
  const calculated = {
    hybridSolarSavingKwh: 4_302,
    hybridSolarSavingEUR: 1_247.58,
    hybridSolar: {
      enabled: true,
      totalHybridUnits: 82,
      totalPvKwh: monthlyTotals.reduce((sum, row) => sum + row.pvKwh, 0),
      totalUsableSolarKwh: 4_800,
      totalContributionPercent: 59.2,
      solarYieldKwhPerKwp: 1_620,
      monthlyTotals,
      rows: [{ quantity: 82, pvWp: 45 }],
      location: { resolvedName: "Poggiardo", solarSource: "European Commission JRC PVGIS 5.3" },
    },
  };

  const report = buildHybridMonthlyReport(calculated, "it");
  assert.ok(report);
  assert.equal(report.units, 82);
  assert.equal(report.installedPvKwp, 3.69);
  assert.equal(report.annualGridOffsetKwh, 4_302);
  assert.equal(report.annualHybridBenefit, 1_247.58);
  assert.equal(report.monthly.length, 12);

  const monthlyOffset = report.monthly.reduce((sum, row) => sum + row.gridOffsetKwh, 0);
  const monthlyBenefit = report.monthly.reduce((sum, row) => sum + row.benefitEur, 0);
  assert.ok(Math.abs(monthlyOffset - calculated.hybridSolarSavingKwh) < 1e-9);
  assert.ok(Math.abs(monthlyBenefit - calculated.hybridSolarSavingEUR) < 1e-9);
  assert.ok(report.monthly.every((row) => row.gridOffsetKwh <= row.usableSolarKwh));
});

test("preliminary proposal uses final hybrid-aware visual pages and appends monthly Hybrid Solar detail", () => {
  const source = fs.readFileSync(new URL("./proposalVisualAuto.js", import.meta.url), "utf8");
  assert.match(source, /from "\.\/proposalFinalVisualPages\.js"/);
  assert.doesNotMatch(source, /proposalVisualPagesSimple/);
  assert.match(source, /appendHybridProposalPage\(this, project, calculated, visualOptions\)/);
});

test("Hybrid dashboard forces thousands grouping for injected Hybrid values", () => {
  const source = fs.readFileSync(new URL("./hybridEconomicAnalysisRuntime.js", import.meta.url), "utf8");
  const groupingUses = source.match(/useGrouping:\s*"always"/g) || [];
  assert.ok(groupingUses.length >= 2);
});