import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("report dashboard loads executive Hybrid refinement without touching access controls", () => {
  const main = read("src/main.jsx");
  const runtime = read("src/reportExecutiveRefinementRuntime.js");
  assert.match(main, /reportExecutiveRefinementRuntime\.js/);
  assert.match(runtime, /Hybrid Solar incluso/);
  assert.match(runtime, /Indicizzazione prezzo energia/);
  assert.match(runtime, /Indicizzazione canone\/OPEX/);
  assert.match(runtime, /hybridSolarSavingKwh/);
  assert.match(runtime, /hybridSolarSavingEUR/);
  assert.doesNotMatch(runtime, /supabase\.auth|agentAllowedViews|currentProfile|pricing|catalogue/);
});

test("executive refinement reads energy and OPEX escalation separately", () => {
  const runtime = read("src/reportExecutiveRefinementRuntime.js");
  assert.match(runtime, /assumptions\?\.energyEscalation/);
  assert.match(runtime, /assumptions\?\.opexEscalation/);
});
