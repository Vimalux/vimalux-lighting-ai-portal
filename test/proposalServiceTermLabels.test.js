import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/preliminaryProposalV2.js", import.meta.url), "utf8");

test("proposal shows CMS and PowerAiD service terms separately", () => {
  assert.match(source, /Durata CMS/);
  assert.match(source, /Durata PowerAiD/);
  assert.match(source, /powerAidServicePeriod/);
  assert.doesNotMatch(source, /Durata servizi Smart/);
  assert.doesNotMatch(source, /"Durata servizi"/);
});
