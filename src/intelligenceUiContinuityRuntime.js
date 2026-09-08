const VIEW_STORAGE_PREFIX = "vimalux-intelligence-last-view";

// Browser-return continuity is deliberately limited to the Business Case workflow.
// Global/admin areas must never take over a project view on browser return.
const PROJECT_VIEW_LABELS = new Map([
  ["cliente e progetto", "customer"],
  ["customer & project", "customer"],
  ["illuminazione esistente", "existing"],
  ["existing lighting", "existing"],
  ["soluzione", "solution"],
  ["solution", "solution"],
  ["costi aggiuntivi di progetto", "additionalCosts"],
  ["additional project costs", "additionalCosts"],
  ["prezzi di progetto", "pricing"],
  ["project pricing", "pricing"],
  ["assunzioni", "assumptions"],
  ["assumptions", "assumptions"],
  ["analisi economica", "business"],
  ["economic analysis", "business"],
  ["rapporto", "report"],
  ["report", "report"],
]);

const PROJECT_VIEW_IDS = new Set(PROJECT_VIEW_LABELS.values());

function norm(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function currentBusinessCaseRef() {
  return new URLSearchParams(window.location.search).get("business_case_id") || "global";
}

function storageKey(ref = currentBusinessCaseRef()) {
  return `${VIEW_STORAGE_PREFIX}:${ref}`;
}

function sidebarCandidates() {
  return [...document.querySelectorAll("aside button, aside a, nav button, nav a")];
}

function projectNavCandidates() {
  return sidebarCandidates().filter((el) => PROJECT_VIEW_LABELS.has(norm(el.textContent)));
}

function isActiveCandidate(element) {
  return Boolean(
    element
      && (element.classList.contains("active")
        || element.getAttribute("aria-current") === "page"),
  );
}

function activeSidebarCandidate() {
  return sidebarCandidates().find(isActiveCandidate) || null;
}

function writeStoredView(ref, view, label = "") {
  if (!PROJECT_VIEW_IDS.has(view)) return;
  try { localStorage.setItem(storageKey(ref), JSON.stringify({ view, label })); } catch (_) {}
}

function storedView(ref = currentBusinessCaseRef()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(ref)) || "null");
    if (!parsed || typeof parsed !== "object" || !PROJECT_VIEW_IDS.has(parsed.view)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function continuityRestoreSignature(ref, savedView, activeView) {
  return `${String(ref || "global")}|${String(savedView || "")}|${String(activeView || "")}`;
}

export function isProjectContinuityView(view) {
  return PROJECT_VIEW_IDS.has(String(view || ""));
}

let restoreTimers = [];
let lastUserNavigationAt = 0;
let restoringView = false;
let lastExplicitView = "";
let lastExplicitRef = "";
let restoreOnReturn = false;
const USER_NAVIGATION_GRACE_MS = 700;

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => clearTimeout(timer));
  restoreTimers = [];
}

function clearExplicitView() {
  lastExplicitView = "";
  lastExplicitRef = "";
}

function rememberManualProjectView(element) {
  const label = norm(element?.textContent);
  const view = PROJECT_VIEW_LABELS.get(label);
  if (!view) return false;
  const ref = currentBusinessCaseRef();
  lastExplicitView = view;
  lastExplicitRef = ref;
  writeStoredView(ref, view, label);
  return true;
}

function captureProjectViewBeforeLeave() {
  const ref = currentBusinessCaseRef();
  const activeSidebar = activeSidebarCandidate();
  const activeLabel = norm(activeSidebar?.textContent);
  const activeProjectView = PROJECT_VIEW_LABELS.get(activeLabel);

  // If a global/admin area is active, do not restore any Business Case view.
  // This prevents CMS Partners/CRM/etc. from being persisted under a project.
  if (!activeProjectView) {
    restoreOnReturn = false;
    clearExplicitView();
    clearRestoreTimers();
    return;
  }

  restoreOnReturn = true;
  lastExplicitView = activeProjectView;
  lastExplicitRef = ref;
  writeStoredView(ref, activeProjectView, activeLabel);
}

function preferredSavedView() {
  const ref = currentBusinessCaseRef();
  if (lastExplicitView && lastExplicitRef === ref && PROJECT_VIEW_IDS.has(lastExplicitView)) {
    return { view: lastExplicitView, label: "" };
  }
  return storedView(ref);
}

function restoreView() {
  if (!restoreOnReturn || document.hidden) return;
  if (Date.now() - lastUserNavigationAt < USER_NAVIGATION_GRACE_MS) return;

  const saved = preferredSavedView();
  if (!saved?.view || !PROJECT_VIEW_IDS.has(saved.view)) return;
  const candidates = projectNavCandidates();
  const target = candidates.find((el) => PROJECT_VIEW_LABELS.get(norm(el.textContent)) === saved.view);
  if (!target) return;
  if (isActiveCandidate(target)) return;

  restoringView = true;
  try {
    target.click();
  } finally {
    restoringView = false;
  }
}

function scheduleReturnRestore() {
  if (!restoreOnReturn) return;
  clearRestoreTimers();
  // Supabase can refresh the session after focus and re-run Business Case link
  // hydration. Restore the project-workflow view after that async window.
  [140, 850, 1700].forEach((delay) => {
    const scheduledAt = Date.now();
    const timer = setTimeout(() => {
      if (lastUserNavigationAt > scheduledAt) return;
      restoreView();
    }, delay);
    restoreTimers.push(timer);
  });
}

function detailsGridForHybridCheckbox(box) {
  return box?.closest?.(".catalogue-tech-grid") || null;
}

function enforceMppt(grid) {
  if (!grid) return;
  const labels = [...grid.querySelectorAll("label")];
  const hybridLabel = labels.find((label) => ["apparecchio ibrido", "hybrid luminaire"].includes(norm(label.querySelector("span")?.textContent)));
  const mpptLabel = labels.find((label) => norm(label.querySelector("span")?.textContent) === "mppt");
  const hybrid = hybridLabel?.querySelector('input[type="checkbox"]');
  const mppt = mpptLabel?.querySelector('input[type="checkbox"]');
  if (!hybrid || !mppt) return;

  if (hybrid.checked) {
    if (!mppt.checked) mppt.click();
    mppt.disabled = true;
    mppt.title = "MPPT required for VIMALUX hybrid luminaires";
    if (mpptLabel?.querySelector("span")) mpptLabel.querySelector("span").textContent = "MPPT · obbligatorio";
  } else {
    mppt.disabled = false;
    mppt.removeAttribute("title");
    if (mpptLabel?.querySelector("span")) mpptLabel.querySelector("span").textContent = "MPPT";
  }
}

function enforceAllMppt() {
  document.querySelectorAll(".catalogue-tech-grid").forEach(enforceMppt);
}

function focusNewestLedProduct() {
  const rows = [...document.querySelectorAll(".catalogue-main-table tbody > tr")];
  const productRows = rows.filter((row) => row.querySelector('input[value="Nuovo prodotto LED"], input[value="New LED product"]'));
  const row = productRows.at(-1);
  if (!row) return;
  row.scrollIntoView({ behavior: "smooth", block: "center" });
  const details = [...row.querySelectorAll("button")].find((button) => ["dettagli", "details"].includes(norm(button.textContent)));
  if (details) details.click();
  const modelInput = row.querySelector("td:nth-child(4) input");
  setTimeout(() => {
    modelInput?.focus();
    modelInput?.select?.();
  }, 120);
}

function isNewLedButton(element) {
  if (!(element instanceof Element)) return false;
  const button = element.closest("button");
  if (!button?.closest(".catalogue-card")) return false;
  const label = norm(button.textContent);
  return label.includes("nuovo prodotto") || label.includes("new product");
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const nav = event.target?.closest?.("aside button, aside a, nav button, nav a");
    if (nav && !restoringView) {
      lastUserNavigationAt = Date.now();
      clearRestoreTimers();
      if (PROJECT_VIEW_LABELS.has(norm(nav.textContent))) {
        rememberManualProjectView(nav);
      } else {
        // Explicit navigation to a global/admin area disables project restore.
        restoreOnReturn = false;
        clearExplicitView();
      }
    }
    if (isNewLedButton(event.target)) setTimeout(focusNewestLedProduct, 180);
  }, true);

  document.addEventListener("change", (event) => {
    const box = event.target;
    if (!(box instanceof HTMLInputElement) || box.type !== "checkbox") return;
    const label = norm(box.closest("label")?.querySelector("span")?.textContent);
    if (label === "apparecchio ibrido" || label === "hybrid luminaire") setTimeout(() => enforceMppt(detailsGridForHybridCheckbox(box)), 0);
  }, true);

  const refresh = () => {
    enforceAllMppt();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      captureProjectViewBeforeLeave();
      clearRestoreTimers();
      return;
    }
    scheduleReturnRestore();
  });
  window.addEventListener("pagehide", () => {
    captureProjectViewBeforeLeave();
    clearRestoreTimers();
  });
  window.addEventListener("blur", () => {
    captureProjectViewBeforeLeave();
    clearRestoreTimers();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) scheduleReturnRestore();
  });
  window.addEventListener("focus", scheduleReturnRestore);
}
