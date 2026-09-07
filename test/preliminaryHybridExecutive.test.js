import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src/preliminaryProposalV2.js"), "utf8");

test("preliminary proposal surfaces Hybrid in executive and solution sections", () => {
  assert.match(source, /Hybrid Solar integration/);
  assert.match(source, /integrazione Hybrid Solar/);
  assert.match(source, /Beneficio Hybrid Solar annuo/);
  assert.match(source, /di cui Hybrid Solar/);
  assert.match(source, /hybridGridOffsetKwh/);
  assert.match(source, /hybridInstalledPvKwp/);
});

test("preliminary proposal separates energy-price and OPEX escalation", () => {
  assert.match(source, /energyEscalation/);
  assert.match(source, /Indicizzazione prezzo energia/);
  assert.match(source, /Indicizzazione canone\/OPEX/);
});

test("proposal refinement does not touch access-control or CRM permissions", () => {
  assert.doesNotMatch(source, /agentAllowedViews|currentProfile|isAgentViewAllowed/);
});
