import { findLinkedProject, navigationKey, readNavigation, writeNavigation } from "./navigationState.js";

export const ACTIVE_PROJECT_KEY = "vimalux-intelligence-active-business-case";
export const PROJECTS_KEY = "vimalux-intelligence-projects";
export const CACHE_OWNER_KEY = "vimalux-intelligence-projects-owner";
export const SOLAR_LOCATION_EVENT = "vimalux:project-solar-location";
export const stableProjectId = (project) => project?.crm?.businessCaseRecordId || project?.id || "";
export const accountKey = (key, userId) => `${key}:${encodeURIComponent(userId)}`;

export function readActiveProject(storage, userId) {
  try {
    const saved = storage.getItem(accountKey(ACTIVE_PROJECT_KEY, userId));
    const owner = storage.getItem(CACHE_OWNER_KEY);
    return saved || ((!owner || owner === userId) ? storage.getItem(ACTIVE_PROJECT_KEY) || "" : "");
  } catch { return ""; }
}

export function readAccountProjects(storage, userId, legacy = []) {
  try {
    const saved = storage.getItem(accountKey(PROJECTS_KEY, userId));
    if (saved) { const rows = JSON.parse(saved); return Array.isArray(rows) ? rows : []; }
    const owner = storage.getItem(CACHE_OWNER_KEY);
    // One-time compatibility with the pre-account cache; never import another account's cache.
    return !owner || owner === userId ? legacy : [];
  } catch { return []; }
}

export function rememberProject(storage, userId, project) {
  try {
    storage.setItem(accountKey(ACTIVE_PROJECT_KEY, userId), stableProjectId(project));
    // Compatibility projection for existing report runtimes, not an input to React selection.
    storage.setItem(ACTIVE_PROJECT_KEY, stableProjectId(project));
  } catch { /* The in-memory context remains usable. */ }
}

export function writeProjectRoute(browser, project, view, replace = true) {
  const url = new URL(browser.location.href);
  url.searchParams.set("business_case_id", stableProjectId(project));
  url.searchParams.delete("opportunity_id");
  if (view) url.searchParams.set("view", view);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${browser.location.pathname}${browser.location.search}${browser.location.hash}`) {
    browser.history[replace ? "replaceState" : "pushState"]({ vimaluxProject: stableProjectId(project), view }, "", next);
  }
  return url.search;
}

export function reconcileHydration(current, loaded, baseline) {
  const before = new Map(baseline.map((p) => [p.id, p]));
  const result = new Map(loaded.map((p) => [p.id, p]));
  for (const project of current) {
    // Keep edits/new drafts made after this load started; do not resurrect unchanged removed cloud rows.
    if (before.get(project.id) !== project) result.set(project.id, project);
  }
  return [...result.values()];
}

export function migrateProjectNavigation(storage, userId, oldId, newId, allowedViews) {
  const view = readNavigation(storage, navigationKey(userId, oldId), allowedViews);
  writeNavigation(storage, navigationKey(userId, newId), view, allowedViews);
  return view;
}

export function initialProjectId(projects, search, remembered = "") {
  const params = new URLSearchParams(search);
  const explicit = params.get("business_case_id"), opportunity = params.get("opportunity_id");
  if (explicit || opportunity) return findLinkedProject(projects, explicit, opportunity)?.id || "";
  return findLinkedProject(projects, remembered)?.id || projects[0]?.id || "";
}

export function createRequestRevision() {
  let revision = 0;
  return { next: () => ++revision, current: () => revision, accepts: (value) => revision === value };
}
