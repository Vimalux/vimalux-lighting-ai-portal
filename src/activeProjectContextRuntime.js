import { businessCaseCodeFromText, resolveProjectByReference } from "./activeBusinessCaseResolver.js";

const STORAGE_KEY = "vimalux-intelligence-active-business-case";
const PROJECTS_KEY = "vimalux-intelligence-projects";
const NEW_PROJECT_CONTEXT_KEY = "vimalux-intelligence-new-project-context";
const NEW_PROJECT_CONTEXT_MAX_MS = 5 * 60 * 1000;
const stableUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function storedProjects() {
  try {
    const rows = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    return Array.isArray(rows) ? rows : (Array.isArray(rows?.projects) ? rows.projects : []);
  } catch (_) {
    return [];
  }
}

function projectForBusinessCase(ref) {
  return resolveProjectByReference(storedProjects(), ref);
}

function stableRecordId(ref) {
  const match = projectForBusinessCase(ref);
  const value = String(match?.crm?.businessCaseRecordId || match?.id || "").trim();
  return stableUuid.test(value) ? value : "";
}

function displayBusinessCaseCode(ref) {
  const match = projectForBusinessCase(ref);
  return String(match?.project?.businessCaseId || match?.crm?.businessCase?.businessCaseId || ref || "").trim();
}

function readNewProjectContext() {
  try {
    const raw = sessionStorage.getItem(NEW_PROJECT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const startedAt = Number(parsed?.startedAt) || 0;
    if (!startedAt || Date.now() - startedAt > NEW_PROJECT_CONTEXT_MAX_MS) {
      sessionStorage.removeItem(NEW_PROJECT_CONTEXT_KEY);
      return null;
    }
    return {
      startedAt,
      previousBusinessCase: String(parsed?.previousBusinessCase || "").trim(),
    };
  } catch (_) {
    return null;
  }
}

function clearNewProjectContext() {
  try { sessionStorage.removeItem(NEW_PROJECT_CONTEXT_KEY); } catch (_) {}
}

function rememberBusinessCaseId(id) {
  const value = stableRecordId(id) || (stableUuid.test(String(id || "").trim()) ? String(id).trim() : "");
  if (!value) return;
  try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
}

function replaceBusinessCaseInUrl(ref) {
  const stable = stableRecordId(ref) || (stableUuid.test(String(ref || "").trim()) ? String(ref).trim() : "");
  if (!stable) return;
  const params = currentParams();
  if (params.get("business_case_id") === stable && !params.get("opportunity_id")) return;
  params.set("business_case_id", stable);
  params.delete("opportunity_id");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`);
}

function restoreBusinessCaseIdIntoUrl() {
  const params = currentParams();
  const explicit = String(params.get("business_case_id") || "").trim();
  if (explicit) {
    const stable = stableRecordId(explicit) || (stableUuid.test(explicit) ? explicit : "");
    if (stable && stable !== explicit) replaceBusinessCaseInUrl(stable);
    if (stable) rememberBusinessCaseId(stable);
    return;
  }
  if (params.get("opportunity_id")) return;
  if (readNewProjectContext()) return;
  let saved = "";
  try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (_) {}
  if (!saved) return;
  replaceBusinessCaseInUrl(saved);
}

function updateHeaderContext() {
  const header = document.querySelector("main > header");
  if (!header) return;
  const small = header.querySelector("div > small");
  if (!small) return;

  const urlRef = String(currentParams().get("business_case_id") || "").trim();
  const renderedCode = businessCaseCodeFromText(small.textContent);
  const ref = urlRef || renderedCode;
  if (!ref) return;

  const match = urlRef ? projectForBusinessCase(urlRef) : projectForBusinessCase(renderedCode);
  if (urlRef && !match) return;
  if (!urlRef && renderedCode && !match) return;

  const stable = String(match?.crm?.businessCaseRecordId || match?.id || "").trim();
  const code = String(match?.project?.businessCaseId || match?.crm?.businessCase?.businessCaseId || renderedCode || ref).trim();
  const projectName = String(match?.project?.name || match?.name || match?.customer?.name || "").trim();
  const stableCloudId = stableUuid.test(stable) ? stable : "";
  const newProjectContext = readNewProjectContext();

  if (newProjectContext) {
    const previousStable = stableRecordId(newProjectContext.previousBusinessCase)
      || (stableUuid.test(newProjectContext.previousBusinessCase) ? newProjectContext.previousBusinessCase : "");

    // While React is switching from the previous project to the newly created
    // local draft, ignore every attempt to restore the previous Business Case.
    // Adopt the new context only after it has received a different stable UUID.
    if (!stableCloudId || (previousStable && stableCloudId === previousStable)) return;
    clearNewProjectContext();
  }

  if (stableCloudId) {
    rememberBusinessCaseId(stableCloudId);
    if (stableCloudId !== urlRef) replaceBusinessCaseInUrl(stableCloudId);
  }

  const desired = projectName ? `${projectName} · ${code}` : code;
  if (desired && small.textContent !== desired) small.textContent = desired;
}

function bindProjectSelection() {
  document.querySelectorAll(".project-select").forEach((button) => {
    if (button.dataset.activeProjectBound === "1") return;
    button.dataset.activeProjectBound = "1";
    button.addEventListener("click", () => {
      clearNewProjectContext();
      const rendered = String(button.querySelector("small")?.textContent || "").trim();
      if (!rendered) return;
      const code = businessCaseCodeFromText(rendered) || rendered;
      const stable = stableRecordId(code);
      if (stable) {
        rememberBusinessCaseId(stable);
        replaceBusinessCaseInUrl(stable);
      }
      queueMicrotask(updateHeaderContext);
    });
  });
}

const reactOwnsProjectContext = typeof document !== "undefined" && document.body?.hasAttribute("data-project-context");
if (!reactOwnsProjectContext) restoreBusinessCaseIdIntoUrl();

if (typeof document !== "undefined" && !reactOwnsProjectContext) {
  const refresh = () => {
    bindProjectSelection();
    updateHeaderContext();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", (event) => {
    if (event.key === PROJECTS_KEY || event.key === STORAGE_KEY) refresh();
  });
}
