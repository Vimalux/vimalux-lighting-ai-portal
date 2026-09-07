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

test("project labels expose the municipality suffix before the full label", () => {
  assert.deepEqual(projectMunicipalityCandidates({
    customer: { name: "Test 1 - Poggiardo" },
    project: { name: "Poggiardo Upgrade Partner (Step 1 of 2)" },
  }).slice(0, 2), ["Poggiardo", "Test 1 - Poggiardo"]);

  assert.equal(projectMunicipalityName({
    customer: { name: "Pilot: Serino" },
  }), "Serino");

  assert.equal(projectMunicipalityName({
    assumptions: { hybridSolarLocation: { query: "CiviSmart – Poggiardo" } },
    customer: { name: "CiviSmart – Poggiardo" },
  }), "Poggiardo");
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

test("automatic runtime uses the same VIMALUX write roles as cloud persistence and exposes diagnostics", () => {
  const runtime = fs.readFileSync(new URL("../src/hybridSolarAutoRuntime.js", import.meta.url), "utf8");
  const economic = fs.readFileSync(new URL("../src/hybridEconomicAnalysisRuntime.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(runtime, /\["admin", "vimalux", "sales_manager"\]/);
  assert.match(runtime, /publishHybridSolarAutoStatus/);
  assert.match(runtime, /saveCloudState\(\[project\]\)/);
  assert.match(runtime, /projectMunicipalityCandidates/);
  assert.match(runtime, /for \(const municipality of candidates\)/);
  assert.match(runtime, /resolveMunicipalitySolar/);
  assert.match(economic, /HYBRID_SOLAR_AUTO_STATUS_EVENT/);
  assert.match(economic, /getHybridSolarAutoStatus/);
  assert.match(main, /hybridSolarAutoRuntime\.js/);
});
