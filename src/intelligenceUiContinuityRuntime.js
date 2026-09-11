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
  ["lista ordini", "orderList"],
  ["order list", "orderList"],
  ["ordreliste", "orderList"],
]);

const PROJECT_VIEW_IDS = new Set(PROJECT_VIEW_LABELS.values());
const USER_NAVIGATION_GRACE_MS = 700;
const RETURN_RESTORE_WINDOW_MS = 10000;

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

export function projectViewFromNavigation(element) {
  const view = element?.dataset?.intelligenceView;
  if (view) return PROJECT_VIEW_IDS.has(view) ? view : null;
  return PROJECT_VIEW_LABELS.get(norm(element?.textContent)) || null;
}

function projectNavCandidates() {
  return sidebarCandidates().filter((el) => projectViewFromNavigation(el));
}

function isActiveCandidate(element) {
  return Boolean(
    element
      && (element.classList.contains("active")
        || element.getAttribute("aria-current") === "page"),
  );
}

function activeProjectCandidate() {
  return projectNavCandidates().find(isActiveCandidate) || null;
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
let restoreUntil = 0;

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => clearTimeout(timer));
  restoreTimers = [];
}

function clearExplicitView() {
  lastExplicitView = "";
  lastExplicitRef = "";
}

function disableProjectRestore() {
  restoreOnReturn = false;
  restoreUntil = 0;
  clearExplicitView();
  clearRestoreTimers();
}

function rememberManualProjectView(element) {
  const label = norm(element?.textContent);
  const view = projectViewFromNavigation(element);
  if (!view) return false;
  const ref = currentBusinessCaseRef();
  lastExplicitView = view;
  lastExplicitRef = ref;
  writeStoredView(ref, view, label);
  return true;
}

function captureProjectViewBeforeLeave() {
  const ref = currentBusinessCaseRef();
  const activeProject = activeProjectCandidate();
  const activeLabel = norm(activeProject?.textContent);
  let activeProjectView = projectViewFromNavigation(activeProject);

  // Blur/pagehide can occur while an unrelated global nav item also carries an
  // active marker, or while React is temporarily rerendering the project menu.
  // Only a Business Case nav item may be used as DOM evidence here. If none is
  // active, preserve the latest explicit project click for the same case.
  if (!activeProjectView && lastExplicitRef === ref && PROJECT_VIEW_IDS.has(lastExplicitView)) {
    activeProjectView = lastExplicitView;
  }

  // Lack of an active Business Case item during blur is not evidence that the
  // user navigated to a global/admin area. Explicit global/admin clicks are the
  // only events allowed to clear project continuity (see click handler below).
  if (!activeProjectView) {
    restoreOnReturn = false;
    restoreUntil = 0;
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
  if (restoreUntil && Date.now() > restoreUntil) return;
  if (Date.now() - lastUserNavigationAt < USER_NAVIGATION_GRACE_MS) return;

  const saved = preferredSavedView();
  if (!saved?.view || !PROJECT_VIEW_IDS.has(saved.view)) return;
  const candidates = projectNavCandidates();
  const target = candidates.find((el) => projectViewFromNavigation(el) === saved.view);
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
  restoreUntil = Date.now() + RETURN_RESTORE_WINDOW_MS;
  // Supabase/auth hydration can complete in more than one async wave after focus.
  // Keep several bounded checks, and let the MutationObserver heal a late React reset
  // during the same short return window.
  [140, 850, 1700, 3500, 7000].forEach((delay) => {
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
      if (projectViewFromNavigation(nav)) {
        rememberManualProjectView(nav);
      } else {
        // Explicit navigation to a global/admin area disables project restore.
        disableProjectRestore();
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
    if (restoreOnReturn && restoreUntil && Date.now() <= restoreUntil) {
      queueMicrotask(restoreView);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-current"] });

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
