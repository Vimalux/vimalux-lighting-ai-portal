import { findLinkedProject, navigationKey, readNavigation, writeNavigation } from "./navigationState.js";
import { isArchivedProject } from "./projectVisibility.js";

export const ACTIVE_PROJECT_KEY = "vimalux-intelligence-active-business-case";
export const PROJECTS_KEY = "vimalux-intelligence-projects";
export const CACHE_OWNER_KEY = "vimalux-intelligence-projects-owner";
export const SOLAR_LOCATION_EVENT = "vimalux:project-solar-location";
export const stableProjectId = (project) => project?.crm?.businessCaseRecordId || project?.id || "";
export const accountKey = (key, userId) => `${key}:${encodeURIComponent(userId)}`;

export function browserCacheProjects(projects = []) {
  return (projects || []).filter((project) => !isArchivedProject(project));
}

export function writeProjectCache(storage, userId, projects = []) {
  const payload = JSON.stringify(browserCacheProjects(projects));
  const accountProjectsKey = accountKey(PROJECTS_KEY, userId);
  const write = () => {
    storage.setItem(accountProjectsKey, payload);
    storage.setItem(PROJECTS_KEY, payload);
    storage.setItem(CACHE_OWNER_KEY, userId);
  };
  try {
    write();
    return true;
  } catch {
    try {
      storage.removeItem(accountProjectsKey);
      storage.removeItem(PROJECTS_KEY);
      write();
      return true;
    } catch {
      return false;
    }
  }
}

// An agent's cloud Business Cases must not remain in persistent browser storage.
// Keep caches belonging to another account intact (especially unsynced Admin work).
export function clearAgentProjectCache(storage, userId, cloudProjects = []) {
  if (!storage || !userId || userId === "local") return;
  try {
    const owned = storage.getItem(CACHE_OWNER_KEY) === userId;
    const keys = [accountKey(PROJECTS_KEY, userId), ...(owned ? [PROJECTS_KEY] : [])];
    const cloud = new Map(cloudProjects.map((item) => [stableProjectId(item), item]));
    const verified = keys.every((key) => {
      const raw = storage.getItem(key);
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      const projects = Array.isArray(parsed) ? parsed : parsed?.projects;
      if (!Array.isArray(projects)) return false;
      return projects.every((item) => {
        const server = cloud.get(stableProjectId(item));
        return Boolean(server) && Date.parse(item.updatedAt || "1970-01-01") <= Date.parse(server.updatedAt || "1970-01-01");
      });
    });
    if (!verified) return false; // Never erase a possibly unsynced legacy draft.
    storage.removeItem(accountKey(PROJECTS_KEY, userId));
    storage.removeItem(accountKey(ACTIVE_PROJECT_KEY, userId));
    if (owned) {
      storage.removeItem(PROJECTS_KEY);
      storage.removeItem(ACTIVE_PROJECT_KEY);
      storage.removeItem(CACHE_OWNER_KEY);
    }
    return true;
  } catch { return false; /* Malformed old data is retained for recovery. */ }
}

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
