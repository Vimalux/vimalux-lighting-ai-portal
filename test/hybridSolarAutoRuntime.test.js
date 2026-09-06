import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { needsAutomaticHybridSolar, projectMunicipalityName } from "../src/hybridSolarAuto.js";

test("municipality is taken from stored solar query before customer name", () => {
  assert.equal(projectMunicipalityName({
    customer: { name: "Poggiardo" },
    assumptions: { hybridSolarLocation: { query: "Comune di Serino" } },
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

test("automatic runtime remains admin-only and is wired into main", () => {
  const runtime = fs.readFileSync(new URL("../src/hybridSolarAutoRuntime.js", import.meta.url), "utf8");
  const main = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(runtime, /profile\?\.role !== "admin"/);
  assert.match(runtime, /saveCloudState\(\[project\]\)/);
  assert.match(runtime, /resolveMunicipalitySolar/);
  assert.match(main, /hybridSolarAutoRuntime\.js/);
});
