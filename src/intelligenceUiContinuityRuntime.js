const VIEW_STORAGE_PREFIX = "vimalux-intelligence-last-view";

const VIEW_LABELS = new Map([
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
  ["crm", "crm"],
  ["cms partners", "datek"],
  ["partner reports", "partnerReports"],
  ["progetti", "projects"],
  ["projects", "projects"],
  ["catalogo prodotti", "catalogue"],
  ["product catalogue", "catalogue"],
  ["amministrazione prezzi", "admin"],
  ["price administration", "admin"],
  ["impostazioni default", "defaults"],
  ["default settings", "defaults"],
  ["rapporto interno", "internalReport"],
  ["internal report", "internalReport"],
]);

function norm(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function currentBusinessCaseRef() {
  return new URLSearchParams(window.location.search).get("business_case_id") || "global";
}

function storageKey(ref = currentBusinessCaseRef()) {
  return `${VIEW_STORAGE_PREFIX}:${ref}`;
}

function navCandidates() {
  return [...document.querySelectorAll("aside button, aside a, nav button, nav a")]
    .filter((el) => VIEW_LABELS.has(norm(el.textContent)));
}

function isActiveCandidate(element) {
  return Boolean(
    element
      && (element.classList.contains("active")
        || element.getAttribute("aria-current") === "page"),
  );
}

function activeNavCandidate() {
  return navCandidates().find(isActiveCandidate) || null;
}

function writeStoredView(ref, view, label = "") {
  if (!view) return;
  try { localStorage.setItem(storageKey(ref), JSON.stringify({ view, label })); } catch (_) {}
}

function storedView(ref = currentBusinessCaseRef()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(ref)) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function continuityRestoreSignature(ref, savedView, activeView) {
  return `${String(ref || "global")}|${String(savedView || "")}|${String(activeView || "")}`;
}

let restoreTimers = [];
let lastUserNavigationAt = 0;
let restoringView = false;
let lastExplicitView = "";
let lastExplicitRef = "";
let hasLeftBrowser = false;
const USER_NAVIGATION_GRACE_MS = 700;

function clearRestoreTimers() {
  restoreTimers.forEach((timer) => clearTimeout(timer));
  restoreTimers = [];
}

function rememberManualView(element) {
  const label = norm(element?.textContent);
  const view = VIEW_LABELS.get(label);
  if (!view) return;
  const ref = currentBusinessCaseRef();
  lastExplicitView = view;
  lastExplicitRef = ref;
  writeStoredView(ref, view, label);
}

function rememberCurrentViewBeforeLeave() {
  const ref = currentBusinessCaseRef();
  if (lastExplicitView && lastExplicitRef === ref) {
    writeStoredView(ref, lastExplicitView);
    return;
  }
  const active = activeNavCandidate();
  if (!active) return;
  const label = norm(active.textContent);
  const view = VIEW_LABELS.get(label);
  if (!view) return;
  lastExplicitView = view;
  lastExplicitRef = ref;
  writeStoredView(ref, view, label);
}

function preferredSavedView() {
  const ref = currentBusinessCaseRef();
  if (lastExplicitView && lastExplicitRef === ref) {
    return { view: lastExplicitView, label: "" };
  }
  return storedView(ref);
}

function restoreView() {
  if (document.hidden) return;
  if (Date.now() - lastUserNavigationAt < USER_NAVIGATION_GRACE_MS) return;

  const saved = preferredSavedView();
  if (!saved?.view) return;
  const candidates = navCandidates();
  const target = candidates.find((el) => VIEW_LABELS.get(norm(el.textContent)) === saved.view);
  if (!target) return; // Permission-safe: unavailable admin views are never forced for agents.
  if (isActiveCandidate(target)) return;

  restoringView = true;
  try {
    target.click();
  } finally {
    restoringView = false;
  }
}

function scheduleReturnRestore() {
  clearRestoreTimers();
  // Supabase can refresh the session after focus and re-run Business Case link
  // hydration. Restore once immediately and again after that async refresh window.
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
    if (!mppt.checked) mppt.click(); // Persist through React onChange, not just DOM state.
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
    if (nav && VIEW_LABELS.has(norm(nav.textContent)) && !restoringView) {
      lastUserNavigationAt = Date.now();
      clearRestoreTimers();
      rememberManualView(nav);
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
      hasLeftBrowser = true;
      rememberCurrentViewBeforeLeave();
      clearRestoreTimers();
      return;
    }
    if (hasLeftBrowser) scheduleReturnRestore();
  });
  window.addEventListener("pagehide", () => {
    hasLeftBrowser = true;
    rememberCurrentViewBeforeLeave();
    clearRestoreTimers();
  });
  window.addEventListener("blur", () => {
    hasLeftBrowser = true;
    rememberCurrentViewBeforeLeave();
    clearRestoreTimers();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && hasLeftBrowser) scheduleReturnRestore();
  });
  window.addEventListener("focus", () => {
    if (hasLeftBrowser) scheduleReturnRestore();
  });
}
