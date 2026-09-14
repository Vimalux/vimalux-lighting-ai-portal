import test from "node:test";
import assert from "node:assert/strict";
import { hybridEconomicDisplayFromResult } from "./hybridEconomicAnalysisRuntime.js";

test("Hybrid economic dashboard exposes the same core solar KPIs as the report summary", () => {
  const project = {
    language: "it",
    project: { currency: "EUR" },
  };
  const result = {
    hybridEligibleGridKwh: 9114,
    hybridSolarSavingKwh: 4302,
    hybridSolarSavingEUR: 1248,
    finalKwh: 20000,
    hybridSolar: {
      enabled: true,
      totalHybridUnits: 82,
      totalPvKwh: 4991,
      totalUsableSolarKwh: 4302,
      totalContributionPercent: 47.2,
      rows: [
        { quantity: 82, pvWp: 45 },
      ],
      location: { municipality: "Poggiardo" },
    },
  };

  const display = hybridEconomicDisplayFromResult(project, result);
  assert.ok(display);
  assert.equal(display.units, 82);
  assert.equal(display.installedPvKwp, 3.69);
  assert.equal(display.annualPvKwh, 4991);
  assert.equal(display.savingKwh, 4302);
  assert.equal(display.savingEur, 1248);
  assert.ok(Math.abs(display.coveragePercent - (4302 / 9114 * 100)) < 0.001);
  assert.equal(display.location, "Poggiardo");
});

test("Hybrid economic dashboard stays hidden when Hybrid Solar is not enabled", () => {
  const display = hybridEconomicDisplayFromResult(
    { language: "it", project: { currency: "EUR" } },
    { hybridSolar: { enabled: false } },
  );
  assert.equal(display, null);
});
