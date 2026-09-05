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
  ["cms partners", "partners"],
  ["partner reports", "partnerReports"],
  ["progetti", "projects"],
  ["projects", "projects"],
  ["catalogo prodotti", "catalogue"],
  ["product catalogue", "catalogue"],
  ["amministrazione prezzi", "priceAdmin"],
  ["price administration", "priceAdmin"],
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

function storageKey() {
  return `${VIEW_STORAGE_PREFIX}:${currentBusinessCaseRef()}`;
}

function navCandidates() {
  return [...document.querySelectorAll("aside button, aside a, nav button, nav a")]
    .filter((el) => VIEW_LABELS.has(norm(el.textContent)));
}

function rememberFromElement(element) {
  const label = norm(element?.textContent);
  const view = VIEW_LABELS.get(label);
  if (!view) return;
  try { localStorage.setItem(storageKey(), JSON.stringify({ view, label })); } catch (_) {}
}

function storedView() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

let lastRestoreSignature = "";
let restoreTimer = null;

function restoreView() {
  if (document.hidden) return;
  const saved = storedView();
  if (!saved?.view) return;
  const candidates = navCandidates();
  const target = candidates.find((el) => VIEW_LABELS.get(norm(el.textContent)) === saved.view);
  if (!target) return; // Permission-safe: unavailable admin views are never forced for agents.

  const signature = `${currentBusinessCaseRef()}|${saved.view}|${norm(target.textContent)}`;
  const active = target.classList.contains("active")
    || target.getAttribute("aria-current") === "page"
    || target.parentElement?.classList.contains("active");
  if (active) {
    lastRestoreSignature = signature;
    return;
  }
  if (lastRestoreSignature === signature) return;
  lastRestoreSignature = signature;
  target.click();
}

function scheduleRestore(delay = 80) {
  clearTimeout(restoreTimer);
  restoreTimer = setTimeout(restoreView, delay);
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
    if (nav && VIEW_LABELS.has(norm(nav.textContent))) rememberFromElement(nav);
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
    scheduleRestore();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();

  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastRestoreSignature = "";
      scheduleRestore(120);
    }
  });
  window.addEventListener("pageshow", () => {
    lastRestoreSignature = "";
    scheduleRestore(120);
  });
}
