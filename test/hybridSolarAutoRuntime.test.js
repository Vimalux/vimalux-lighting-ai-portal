import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { needsAutomaticHybridSolar, projectMunicipalityCandidates, projectMunicipalityName } from "../src/hybridSolarAuto.js";

test("municipality is taken from stored solar query before customer name", () => {
  assert.equal(projectMunicipalityName({
    customer: { name: "Poggiardo" },
    assumptions: { hybridSolarLocation: { query: "Comune di Serino" } },
  }), "Serino");
});

test("test and pilot project labels expose the municipality before the full label", () => {
  assert.deepEqual(projectMunicipalityCandidates({
    customer: { name: "Test 1 - Poggiardo" },
    project: { name: "Poggiardo Upgrade Partner (Step 1 of 2)" },
  }).slice(0, 2), ["Poggiardo", "Poggiardo Upgrade Partner (Step 1 of 2)"]);

  assert.equal(projectMunicipalityName({
    customer: { name: "Pilot: Serino" },
  }), "Serino");
});

test("customer municipality enables automatic solar only for hybrid projects without yield", () => {
  const project = { customer: { name: "Comune di Poggiardo" }, assumptions: {} };
  assert.equal(needsAutomaticHybridSolar(project, {
    hybridSolar: { enabled: true, totalHybridUnits: 82, solarYieldKwhPerKwp: 0 },
  }), true);
  assert.equal(needsAutomaticHybridSolar(project, {
    hybridSolar: { enabled: false, totalHybridUnits: 0, solarYieldKwhPerKwp: 0 },
  }), false);
  assert.equal(needsAutomaticHybridSolar(project, {
    hybridSolar: { enabled: true, totalHybridUnits: 82, solarYieldKwhPerKwp: 1450 },
  }), false);
});

test("automatic runtime remains admin-only and retries municipality candidates", () => {
  const runtime = fs.readFileSync(new URL("../src/hybridSolarAutoRuntime.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(runtime, /profile\?\.role !== "admin"/);
  assert.match(runtime, /saveCloudState\(\[project\]\)/);
  assert.match(runtime, /projectMunicipalityCandidates/);
  assert.match(runtime, /for \(const municipality of candidates\)/);
  assert.match(runtime, /resolveMunicipalitySolar/);
  assert.match(main, /hybridSolarAutoRuntime\.js/);
});
