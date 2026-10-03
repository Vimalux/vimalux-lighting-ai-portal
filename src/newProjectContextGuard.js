const ACTIVE_CASE_STORAGE_KEY = "vimalux-intelligence-active-business-case";
const NEW_PROJECT_CONTEXT_KEY = "vimalux-intelligence-new-project-context";

function clearBusinessCaseContext() {
  const url = new URL(window.location.href);
  let previousBusinessCase = String(url.searchParams.get("business_case_id") || "").trim();
  if (!previousBusinessCase) {
    try { previousBusinessCase = String(localStorage.getItem(ACTIVE_CASE_STORAGE_KEY) || "").trim(); } catch (_) {}
  }

  const managedKeys = ["business_case_id", "opportunity_id"];
  let changed = false;
  for (const key of managedKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const query = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${query ? `?${query}` : ""}${url.hash || ""}`);
  }

  // A new project must never inherit the previously viewed Business Case.
  // The previous reference is retained only inside a short-lived context lock,
  // so the runtime can refuse to restore it while the new draft receives its UUID.
  try { localStorage.removeItem(ACTIVE_CASE_STORAGE_KEY); } catch (_) {}
  try {
    sessionStorage.setItem(NEW_PROJECT_CONTEXT_KEY, JSON.stringify({
      startedAt: Date.now(),
      previousBusinessCase,
    }));
  } catch (_) {}
}

function isNewProjectButton(target) {
  const button = target?.closest?.("button");
  if (!button) return false;
  const text = String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  return text === "+ nuovo progetto" || text === "+ new project" || text === "nuovo progetto" || text === "new project";
}

function start() {
  if (document.body?.hasAttribute("data-project-context")) return;
  // Capture phase runs before React's onClick, so the newly created local project
  // cannot inherit a stable Business Case / Opportunity URL or remembered context
  // from the project the user was previously viewing.
  document.addEventListener("click", (event) => {
    if (isNewProjectButton(event.target)) clearBusinessCaseContext();
  }, true);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
