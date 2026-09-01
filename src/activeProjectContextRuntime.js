const STORAGE_KEY = "vimalux-intelligence-active-business-case";
const PROJECTS_KEY = "vimalux-intelligence-projects";

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function storedProjects() {
  try {
    const rows = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function projectForBusinessCase(ref) {
  const value = String(ref || "").trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  return storedProjects().find((item) => {
    const ids = [item?.id, item?.crm?.businessCaseRecordId].map((entry) => String(entry || "").trim());
    const codes = [item?.project?.businessCaseId, item?.crm?.businessCase?.businessCaseId]
      .map((entry) => String(entry || "").trim().toUpperCase());
    return ids.includes(value) || codes.includes(upper);
  }) || null;
}

function stableRecordId(ref) {
  const match = projectForBusinessCase(ref);
  return String(match?.crm?.businessCaseRecordId || match?.id || ref || "").trim();
}

function displayBusinessCaseCode(ref) {
  const match = projectForBusinessCase(ref);
  return String(match?.project?.businessCaseId || match?.crm?.businessCase?.businessCaseId || ref || "").trim();
}

function rememberBusinessCaseId(id) {
  const value = stableRecordId(id);
  if (!value) return;
  try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {}
}

function replaceBusinessCaseInUrl(ref) {
  const stable = stableRecordId(ref);
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
    // Human-readable BC codes are valid display identifiers, but database/RPC
    // loading must use the immutable Business Case record UUID whenever known.
    const stable = stableRecordId(explicit);
    if (stable && stable !== explicit) replaceBusinessCaseInUrl(stable);
    rememberBusinessCaseId(stable || explicit);
    return;
  }
  if (params.get("opportunity_id")) return;
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
  const renderedCode = String(small.textContent || "").match(/BC-[A-Z0-9-]+/i)?.[0] || "";
  const ref = urlRef || renderedCode;
  if (!ref) return;

  const match = projectForBusinessCase(ref) || projectForBusinessCase(renderedCode);
  const stable = String(match?.crm?.businessCaseRecordId || match?.id || ref).trim();
  const code = String(match?.project?.businessCaseId || match?.crm?.businessCase?.businessCaseId || renderedCode || ref).trim();
  const projectName = String(match?.project?.name || match?.name || match?.customer?.name || "").trim();

  rememberBusinessCaseId(stable);
  if (urlRef && stable && stable !== urlRef) replaceBusinessCaseInUrl(stable);

  const desired = projectName ? `${projectName} · ${code}` : code;
  if (desired && small.textContent !== desired) small.textContent = desired;
}

function bindProjectSelection() {
  document.querySelectorAll(".project-select").forEach((button) => {
    if (button.dataset.activeProjectBound === "1") return;
    button.dataset.activeProjectBound = "1";
    button.addEventListener("click", () => {
      const rendered = String(button.querySelector("small")?.textContent || "").trim();
      if (!rendered) return;
      const code = rendered.match(/BC-[A-Z0-9-]+/i)?.[0] || rendered;
      const stable = stableRecordId(code);
      rememberBusinessCaseId(stable);
      replaceBusinessCaseInUrl(stable);
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
