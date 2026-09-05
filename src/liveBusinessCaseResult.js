const STORE_KEY = "__VIMALUX_LIVE_BUSINESS_CASE_RESULTS__";
const EVENT_NAME = "vimalux:business-case-calculated";

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
  const params = new URLSearchParams(search || "");
  const keys = [params.get("business_case_id"), params.get("opportunity_id")]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const key of keys) {
    const entry = store.get(key);
    if (entry) return entry;
  }
  return null;
}

export const LIVE_BUSINESS_CASE_EVENT = EVENT_NAME;
