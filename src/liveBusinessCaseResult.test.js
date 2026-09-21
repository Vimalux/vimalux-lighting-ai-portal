import test from "node:test";
import assert from "node:assert/strict";
import {
  getActiveBusinessCaseResult,
  getCurrentBusinessCaseResult,
  getLiveBusinessCaseResult,
  publishActiveBusinessCaseResult,
  publishLiveBusinessCaseResult,
} from "./liveBusinessCaseResult.js";

function withFakeWindow(run) {
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  global.window = { dispatchEvent() {}, location: { search: "" } };
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

test("active Business Case remains authoritative while background calculations publish stale data", () => {
  withFakeWindow(() => {
    const route = "?business_case_id=feletto-record";
    const activeProject = { id: "local-feletto", assumptions: { analysisPeriod: 12 } };
    const activeResult = { analysisPeriod: 12 };
    publishActiveBusinessCaseResult(activeProject, activeResult, route);

    publishLiveBusinessCaseResult(
      { id: "feletto-record", assumptions: { analysisPeriod: 20 } },
      { analysisPeriod: 20 },
    );

    const active = getActiveBusinessCaseResult(route);
    assert.equal(active.project, activeProject);
    assert.equal(active.result.analysisPeriod, 12);
    assert.equal(getCurrentBusinessCaseResult(route).result.analysisPeriod, 12);
  });
});

test("active Business Case does not leak into a different route", () => {
  withFakeWindow(() => {
    publishActiveBusinessCaseResult({ id: "feletto" }, { analysisPeriod: 12 }, "?business_case_id=feletto");
    assert.equal(getActiveBusinessCaseResult("?business_case_id=another-case"), null);
  });
});

test("current Business Case falls back to route-matched live data when no active result exists", () => {
  withFakeWindow(() => {
    publishLiveBusinessCaseResult({ id: "feletto" }, { analysisPeriod: 12 });
    assert.equal(getCurrentBusinessCaseResult("?business_case_id=feletto").result.analysisPeriod, 12);
  });
});
