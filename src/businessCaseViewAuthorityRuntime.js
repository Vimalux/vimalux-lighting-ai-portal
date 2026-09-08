const STORAGE_PREFIX = "vimalux-intelligence-authoritative-view";
const ACTIVE_CASE_STORAGE_KEY = "vimalux-intelligence-active-business-case";
const PROJECTS_STORAGE_KEY = "vimalux-intelligence-projects";
const USER_NAVIGATION_GRACE_MS = 500;

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

function readProjectsFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function canonicalBusinessCaseRef(explicitRef, projects = [], rememberedRef = "") {
  const explicit = String(explicitRef || "").trim();
  const remembered = String(rememberedRef || "").trim();
  if (!explicit) return remembered || "global";
  const upper = explicit.toUpperCase();
  const match = projects.find((item) => {
    const ids = [item?.id, item?.crm?.businessCaseRecordId]
      .map((entry) => String(entry || "").trim());
    const codes = [item?.project?.businessCaseId, item?.crm?.businessCase?.businessCaseId]
      .map((entry) => String(entry || "").trim().toUpperCase());
    return ids.includes(explicit) || codes.includes(upper);
  });
  return String(match?.crm?.businessCaseRecordId || match?.id || explicit).trim();
}

export function isAuthoritativeBusinessCaseView(view) {
  return PROJECT_VIEW_IDS.has(String(view || ""));
}

function currentBusinessCaseRef() {
  const explicit = new URLSearchParams(window.location.search).get("business_case_id") || "";
  let remembered = "";
  try { remembered = localStorage.getItem(ACTIVE_CASE_STORAGE_KEY) || ""; } catch (_) {}
  return canonicalBusinessCaseRef(explicit, readProjectsFromStorage(), remembered);
}

function storageKey(ref) {
  return `${STORAGE_PREFIX}:${ref}`;
}

function projectNavCandidates() {
  return [...document.querySelectorAll("aside nav button, aside nav a")]
    .filter((element) => PROJECT_VIEW_LABELS.has(norm(element.textContent)));
}

function isActive(element) {
  return Boolean(
    element
      && (element.classList.contains("active")
        || element.getAttribute("aria-current") === "page"),
  );
}

function activeProjectView() {
  const element = projectNavCandidates().find(isActive) || null;
  if (!element) return { element: null, view: "" };
  return { element, view: PROJECT_VIEW_LABELS.get(norm(element.textContent)) || "" };
}

function targetForView(view) {
  return projectNavCandidates().find(
    (element) => PROJECT_VIEW_LABELS.get(norm(element.textContent)) === view,
  ) || null;
}

function persistDesired(ref, view) {
  if (!ref || !PROJECT_VIEW_IDS.has(view)) return;
  try { localStorage.setItem(storageKey(ref), view); } catch (_) {}
}

function storedDesired(ref) {
  try {
    const view = localStorage.getItem(storageKey(ref)) || "";
    return PROJECT_VIEW_IDS.has(view) ? view : "";
  } catch (_) {
    return "";
  }
}

let authoritative = false;
let authoritativeRef = "";
let desiredView = "";
let restoring = false;
let lastUserNavigationAt = 0;
let healTimers = [];

function clearHealTimers() {
  healTimers.forEach((timer) => clearTimeout(timer));
  healTimers = [];
}

function disarmAuthority() {
  authoritative = false;
  authoritativeRef = "";
  desiredView = "";
  clearHealTimers();
}

function armAuthority(ref, view) {
  if (!ref || ref === "global" || !PROJECT_VIEW_IDS.has(view)) return;
  authoritative = true;
  authoritativeRef = ref;
  desiredView = view;
  persistDesired(ref, view);
}

function rememberManualProjectView(element) {
  const view = PROJECT_VIEW_LABELS.get(norm(element?.textContent)) || "";
  if (!PROJECT_VIEW_IDS.has(view)) return;
  armAuthority(currentBusinessCaseRef(), view);
}

function captureCurrentProjectView() {
  const ref = currentBusinessCaseRef();
  const active = activeProjectView();
  if (active.view) {
    armAuthority(ref, active.view);
    return;
  }
  if (authoritative && authoritativeRef === ref && PROJECT_VIEW_IDS.has(desiredView)) return;
  const stored = storedDesired(ref);
  if (stored) armAuthority(ref, stored);
}

function healAuthoritativeView() {
  if (!authoritative || restoring || document.hidden) return;
  if (Date.now() - lastUserNavigationAt < USER_NAVIGATION_GRACE_MS) return;

  const ref = currentBusinessCaseRef();
  if (!ref || ref === "global" || ref !== authoritativeRef) {
    disarmAuthority();
    return;
  }

  const active = activeProjectView();
  if (active.view === desiredView) return;

  // The known unwanted drift is App.jsx/Supabase hydration resetting the same
  // Business Case to Cliente e Progetto. Do not fight other programmatic views.
  if (active.view && active.view !== "customer") return;

  const target = targetForView(desiredView);
  if (!target) return;

  restoring = true;
  try {
    target.click();
  } finally {
    restoring = false;
  }
}

function scheduleHealBurst() {
  if (!authoritative) return;
  clearHealTimers();
  [0, 120, 500, 1500, 4000].forEach((delay) => {
    healTimers.push(setTimeout(healAuthoritativeView, delay));
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    if (restoring) return;

    const projectSelect = event.target?.closest?.(".project-select");
    if (projectSelect) {
      lastUserNavigationAt = Date.now();
      disarmAuthority();
      return;
    }

    const nav = event.target?.closest?.("aside button, aside a, nav button, nav a");
    if (!nav) return;

    lastUserNavigationAt = Date.now();
    clearHealTimers();
    if (PROJECT_VIEW_LABELS.has(norm(nav.textContent))) {
      rememberManualProjectView(nav);
    } else {
      disarmAuthority();
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (authoritative) queueMicrotask(healAuthoritativeView);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-current"],
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      captureCurrentProjectView();
      clearHealTimers();
      return;
    }
    scheduleHealBurst();
  });

  window.addEventListener("blur", () => {
    captureCurrentProjectView();
    clearHealTimers();
  });
  window.addEventListener("pagehide", () => {
    captureCurrentProjectView();
    clearHealTimers();
  });
  window.addEventListener("focus", scheduleHealBurst);
  window.addEventListener("pageshow", scheduleHealBurst);
}
