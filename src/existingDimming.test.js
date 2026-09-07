import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { nightlyDimmingMetrics, normalizeNightlyDimmingProject, summarizeExistingDimming } from "./existingDimming.js";

const group = {
  id: "g1",
  quantity: 162,
  existingDimmingProfile: "fixed",
  existingDimmingMethod: "profile",
  existingFullPowerHours: 6.5,
  existingReducedHours: 5,
  existingReducedLoadPercent: 70,
  existingDimmingNote: "00:00-05:00",
};

test("6.5h full + 5h at 70% residual becomes about 13% annual reduction", () => {
  const metrics = nightlyDimmingMetrics(group, 4200);
  assert.equal(metrics.nightly, true);
  assert.equal(metrics.reductionDuringReducedPct, 30);
  assert.ok(Math.abs(metrics.annualReductionPct - 13.0434782609) < 1e-6);
  assert.ok(Math.abs(metrics.annualFullHours + metrics.annualReducedHours - 4200) < 1e-6);
});

test("nightly inputs are converted only in the calculation copy", () => {
  const project = { assumptions: { operatingHours: 4200 }, groups: [group] };
  const normalized = normalizeNightlyDimmingProject(project);
  assert.equal(project.groups[0].existingFullPowerHours, 6.5);
  assert.equal(project.groups[0].existingReducedHours, 5);
  assert.ok(normalized.groups[0].existingFullPowerHours > 2000);
  assert.ok(normalized.groups[0].existingReducedHours > 1800);
  assert.equal(normalized.groups[0].existingDimmingInputBasis, "night");
});

test("legacy annual-hour profiles stay unchanged", () => {
  const legacy = { ...group, existingFullPowerHours: 2374, existingReducedHours: 1826 };
  const normalized = normalizeNightlyDimmingProject({ assumptions: { operatingHours: 4200 }, groups: [legacy] });
  assert.equal(normalized.groups[0].existingFullPowerHours, 2374);
  assert.equal(normalized.groups[0].existingReducedHours, 1826);
});

test("summary exposes the client-facing nightly profile", () => {
  const summary = summarizeExistingDimming({ assumptions: { operatingHours: 4200 }, groups: [group] });
  assert.equal(summary.active, true);
  assert.equal(summary.profiles[0].quantity, 162);
  assert.equal(summary.profiles[0].fullPowerHoursPerNight, 6.5);
  assert.equal(summary.profiles[0].reducedHoursPerNight, 5);
  assert.equal(summary.profiles[0].reductionDuringReducedPct, 30);
});

test("nightly dimming is wired into calculation, UI labels and customer proposal", () => {
  const calculations = fs.readFileSync(new URL("./calculations.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./dimming-nightly.css", import.meta.url), "utf8");
  const proposal = fs.readFileSync(new URL("./proposalCostEvolutionPage.js", import.meta.url), "utf8");
  assert.match(calculations, /normalizeNightlyDimmingProject/);
  assert.match(main, /dimming-nightly\.css/);
  assert.match(css, /Ore a piena potenza \/ notte/);
  assert.match(css, /70 = riduzione 30%/);
  assert.match(proposal, /Profilo dimmer esistente/);
  assert.match(proposal, /summarizeExistingDimming/);
});
