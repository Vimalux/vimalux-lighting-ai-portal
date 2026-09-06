import test from "node:test";
import assert from "node:assert/strict";
import { getLiveBusinessCaseResult, publishLiveBusinessCaseResult } from "./liveBusinessCaseResult.js";

function withFakeWindow(run) {
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  global.window = { dispatchEvent() {} };
  global.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  try { run(); } finally {
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow;
    if (previousCustomEvent === undefined) delete global.CustomEvent; else global.CustomEvent = previousCustomEvent;
  }
}

test("live Business Case result is resolved by URL business_case_id", () => {
  withFakeWindow(() => {
    const project = { id: "bc-record-1", project: { businessCaseId: "BC-TEST" }, crm: { opportunityId: "opp-1" } };
    const result = { hybridSolar: { enabled: true, totalHybridUnits: 82 }, hybridSolarSavingKwh: 1234 };
    publishLiveBusinessCaseResult(project, result);
    const live = getLiveBusinessCaseResult("?business_case_id=bc-record-1");
    assert.equal(live.project, project);
    assert.equal(live.result, result);
    assert.equal(live.result.hybridSolar.totalHybridUnits, 82);
  });
});

test("live Business Case result does not fall through to another project", () => {
  withFakeWindow(() => {
    publishLiveBusinessCaseResult({ id: "other-project" }, { hybridSolar: { enabled: true } });
    assert.equal(getLiveBusinessCaseResult("?business_case_id=missing-project"), null);
  });
});
