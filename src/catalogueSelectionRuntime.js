import { supabase, stagingPreview } from "./supabase.js";

const catalogueState = {
  loaded: false,
  byId: new Map(),
};

const canonicalName = (product = {}) => String(product.model || product.name || product.supplierSku || product.id || "").trim();
const canonicalLabel = (product = {}) => {
  const brand = String(product.brand || "VIMALUX").trim();
  const name = canonicalName(product);
  const wattage = Number(product.wattage);
  return `${brand}${name ? ` ${name}` : ""}${Number.isFinite(wattage) && wattage > 0 ? ` · ${wattage} W` : ""}`.trim();
};

function isProductSelect(select) {
  return Array.from(select.options || []).some((option) => String(option.value || "").startsWith("led-"));
}

function reconcileSelect(select) {
  if (!catalogueState.loaded || !isProductSelect(select)) return;
  const selectedValue = String(select.value || "");
  const options = Array.from(select.options || []);

  for (const option of options) {
    const id = String(option.value || "");
    if (!id.startsWith("led-")) continue;
    const product = catalogueState.byId.get(id);

    if (!product) {
      if (id !== selectedValue) option.remove();
      continue;
    }

    const selectable = product.active !== false && product.historicalOnly !== true;
    if (!selectable && id !== selectedValue) {
      option.remove();
      continue;
    }

    option.textContent = `${canonicalLabel(product)}${selectable ? "" : " · Legacy / inattivo"}`;
  }
}

function reconcileDom() {
  document.querySelectorAll("select").forEach(reconcileSelect);
}

async function loadMasterCatalogue() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("get_intelligence_catalogue");
  if (error || !data) return false;

  catalogueState.byId = new Map((data.led || []).map((product) => [String(product.id), product]));
  catalogueState.loaded = true;
  reconcileDom();
  return true;
}

function start() {
  const observer = new MutationObserver(() => reconcileDom());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let attempts = 0;
  const retry = async () => {
    attempts += 1;
    const ok = await loadMasterCatalogue();
    if (!ok && attempts < 12) setTimeout(retry, 1500);
  };
  retry();

  if (!stagingPreview && supabase?.auth) {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadMasterCatalogue();
    });
  }

  window.addEventListener("focus", () => loadMasterCatalogue());
  window.addEventListener("storage", () => reconcileDom());
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
