const STORE_KEY = "__VIMALUX_LIVE_BUSINESS_CASE_RESULTS__";
const ACTIVE_STORE_KEY = "__VIMALUX_ACTIVE_BUSINESS_CASE_RESULT__";
const EVENT_NAME = "vimalux:business-case-calculated";

function routeKeys(search = "") {
  const params = new URLSearchParams(search || "");
  return [params.get("business_case_id"), params.get("opportunity_id")]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function projectKeys(project = {}) {
  return [
    project?.id,
    project?.crm?.businessCaseRecordId,
    project?.project?.businessCaseId,
    project?.crm?.opportunityId,
    project?.crm?.uniqueProjectId,
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

export function publishLiveBusinessCaseResult(project, result) {
  if (typeof window === "undefined") return result;
  const store = window[STORE_KEY] instanceof Map ? window[STORE_KEY] : new Map();
  const entry = { project, result };
  const keys = projectKeys(project);
  keys.forEach((key) => store.set(key, entry));
  window[STORE_KEY] = store;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { keys } }));
  return result;
}

export function getLiveBusinessCaseResult(search = "") {
  if (typeof window === "undefined") return null;
  const store = window[STORE_KEY];
  if (!(store instanceof Map)) return null;
  const keys = routeKeys(search);
  for (const key of keys) {
    const entry = store.get(key);
    if (entry) return entry;
  }
  return null;
}

export function publishActiveBusinessCaseResult(project, result, search = "") {
  if (typeof window === "undefined") return result;
  window[ACTIVE_STORE_KEY] = {
    project,
    result,
    routeKeys: routeKeys(search || window.location?.search || ""),
  };
  return result;
}

export function getActiveBusinessCaseResult(search = "") {
  if (typeof window === "undefined") return null;
  const entry = window[ACTIVE_STORE_KEY];
  if (!entry?.project) return null;
  const requested = routeKeys(search);
  if (!requested.length) return entry;
  const allowed = new Set([...(entry.routeKeys || []), ...projectKeys(entry.project)]);
  return requested.some((key) => allowed.has(key)) ? entry : null;
}

export const LIVE_BUSINESS_CASE_EVENT = EVENT_NAME;
