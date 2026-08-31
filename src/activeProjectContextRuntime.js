const STORAGE_KEY = "vimalux-intelligence-active-business-case";
const PROJECTS_KEY = "vimalux-intelligence-projects";

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function rememberBusinessCaseId(id) {
  const value = String(id || "").trim();
  if (!value) return;
  try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
}

function restoreBusinessCaseIdIntoUrl() {
  const params = currentParams();
  if (params.get("business_case_id") || params.get("opportunity_id")) return;
  let saved = "";
  try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (_) {}
  if (!saved) return;
  params.set("business_case_id", saved);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`);
}

function projectNameForBusinessCase(id) {
  if (!id) return "";
  try {
    const rows = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    const match = Array.isArray(rows) ? rows.find((item) =>
      item?.id === id ||
      item?.project?.businessCaseId === id ||
      item?.crm?.businessCaseRecordId === id
    ) : null;
    return String(match?.project?.name || match?.name || match?.customer?.name || "").trim();
  } catch (_) {
    return "";
  }
}

function updateHeaderContext() {
  const header = document.querySelector("main > header");
  if (!header) return;
  const small = header.querySelector("div > small");
  if (!small) return;

  // A business_case_id explicitly present in the URL is canonical. Never let a
  // previously rendered header value or persisted DOM dataset override it.
  const urlBusinessCaseId = String(currentParams().get("business_case_id") || "").trim();
  const renderedMatch = String(small.textContent || "").match(/BC-[A-Z0-9-]+/i);
  const businessCaseId = urlBusinessCaseId || renderedMatch?.[0] || "";
  if (!businessCaseId) return;

  rememberBusinessCaseId(businessCaseId);
  const projectName = projectNameForBusinessCase(businessCaseId);
  const desired = projectName ? `${projectName} · ${businessCaseId}` : businessCaseId;
  if (small.textContent !== desired) small.textContent = desired;
}

function bindProjectSelection() {
  document.querySelectorAll(".project-select").forEach((button) => {
    if (button.dataset.activeProjectBound === "1") return;
    button.dataset.activeProjectBound = "1";
    button.addEventListener("click", () => {
      const businessCaseId = String(button.querySelector("small")?.textContent || "").trim();
      if (!businessCaseId) return;
      rememberBusinessCaseId(businessCaseId);
      const params = currentParams();
      params.set("business_case_id", businessCaseId);
      params.delete("opportunity_id");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`);
      queueMicrotask(updateHeaderContext);
    });
  });
}

restoreBusinessCaseIdIntoUrl();

if (typeof document !== "undefined") {
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
