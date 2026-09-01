import { compatibleLedProducts, isCatalogueProductCompatible, normalizeProductCategory } from "./productCatalogue.js";

const STORAGE_KEY = "vimalux-intelligence-projects";
const DISMISS_KEY = "vimalux-catalogue-reconcile-dismissed";
const numberValue = (value) => {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const targetLedWattage = (group = {}) => {
  const wattage = Math.max(0, numberValue(group.existingWattage));
  const technology = String(group.technology || "").toUpperCase();
  if (!wattage) return Math.max(0, numberValue(group.importedRecommendedWattage || group.projectLedWattage));
  if (technology === "LED") return wattage * 0.70;
  if (["SAP", "MH", "MERCURY"].includes(technology)) return wattage / 3;
  return wattage * 0.50;
};

export function reconcileImportedGroupProduct(group, ledProducts = []) {
  if (!group || typeof group !== "object") return group;
  const category = normalizeProductCategory(group.luminaireCategory || group.existingCategory);
  if (category === "OTHER") return group;

  const current = ledProducts.find((product) => String(product?.id) === String(group.proposedProductId || ""));
  const requirement = group.replacementRequirement || "UNKNOWN";
  if (current && isCatalogueProductCompatible(current, category, requirement)) return group;

  const candidates = compatibleLedProducts(ledProducts, category, requirement)
    .filter((product) => numberValue(product?.wattage) > 0);

  // Never turn an existing assignment into an empty product just because the
  // current catalogue has no compatible automatic replacement. Existing
  // Business Cases must remain usable and the product must be changed manually
  // when a valid replacement is eventually available.
  if (!candidates.length) return group;

  const target = targetLedWattage(group);
  const selected = [...candidates].sort((a, b) => {
    const aW = numberValue(a.wattage);
    const bW = numberValue(b.wattage);
    return Math.abs(aW - target) - Math.abs(bW - target) || aW - bW;
  })[0];

  return {
    ...group,
    proposedProductId: selected.id,
    projectLedWattage: numberValue(selected.wattage),
    importedRecommendedWattage: Math.round(target * 10) / 10,
  };
}

export function reconciliationChanges(project) {
  if (!project?.importedTechnical || !Array.isArray(project.groups)) return [];
  const ledProducts = Array.isArray(project.catalogue?.led) ? project.catalogue.led : [];
  if (!ledProducts.length) return [];

  return project.groups.flatMap((group, index) => {
    const next = reconcileImportedGroupProduct(group, ledProducts);
    if (next === group || (
      next.proposedProductId === group.proposedProductId &&
      next.projectLedWattage === group.projectLedWattage
    )) return [];

    const oldProduct = ledProducts.find((p) => String(p?.id) === String(group.proposedProductId || ""));
    const newProduct = ledProducts.find((p) => String(p?.id) === String(next.proposedProductId || ""));
    return [{
      index,
      group,
      next,
      category: normalizeProductCategory(group.luminaireCategory || group.existingCategory),
      oldProductId: oldProduct?.id || group.proposedProductId || "-",
      newProductId: newProduct?.id || next.proposedProductId || "-",
    }];
  });
}

export function reconcileImportedProjectProductCategories(project) {
  const changes = reconciliationChanges(project);
  if (!changes.length) return project;
  const byIndex = new Map(changes.map((change) => [change.index, change.next]));
  const groups = project.groups.map((group, index) => byIndex.get(index) || group);
  return { ...project, groups, updatedAt: new Date().toISOString() };
}

function readStoredContainer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return { parsed, projects: parsed, wrapped: false };
    if (Array.isArray(parsed?.projects)) return { parsed, projects: parsed.projects, wrapped: true };
    return { parsed: [], projects: [], wrapped: false };
  } catch {
    return { parsed: [], projects: [], wrapped: false };
  }
}

function currentBusinessCaseId() {
  try {
    return new URLSearchParams(window.location.search).get("business_case_id") || "";
  } catch {
    return "";
  }
}

function matchesCurrentProject(project, businessCaseId) {
  if (!businessCaseId) return false;
  return [
    project?.id,
    project?.crm?.businessCaseRecordId,
    project?.project?.businessCaseId,
  ].some((value) => String(value || "") === String(businessCaseId));
}

function confirmationText(project, changes) {
  const it = project?.language === "it";
  const preview = changes.slice(0, 5).map((change) =>
    `${change.category}: ${change.oldProductId} → ${change.newProductId}`
  ).join("\n");
  const extra = changes.length > 5 ? `\n+ ${changes.length - 5} ${it ? "altre assegnazioni" : "more assignments"}` : "";
  return it
    ? `${changes.length} assegnazioni prodotto non sono più compatibili con il catalogo attuale. Vuoi aggiornarle automaticamente?\n\n${preview}${extra}\n\nVerranno modificati solo i prodotti non compatibili. Quantità, potenze esistenti, prezzi, CRM e altre impostazioni del Business Case restano invariati.`
    : `${changes.length} product assignments are no longer compatible with the current catalogue. Update them automatically?\n\n${preview}${extra}\n\nOnly incompatible product assignments will be changed. Quantities, existing wattages, prices, CRM and all other Business Case settings remain unchanged.`;
}

function reconcileCurrentStoredProjectWithConfirmation() {
  const businessCaseId = currentBusinessCaseId();
  if (!businessCaseId) return;
  const container = readStoredContainer();
  const index = container.projects.findIndex((project) => matchesCurrentProject(project, businessCaseId));
  if (index < 0) return;

  const project = container.projects[index];
  const changes = reconciliationChanges(project);
  if (!changes.length) {
    sessionStorage.removeItem(`${DISMISS_KEY}:${businessCaseId}`);
    return;
  }

  const signature = changes.map((change) => `${change.index}:${change.oldProductId}:${change.newProductId}`).join("|");
  const dismissKey = `${DISMISS_KEY}:${businessCaseId}`;
  if (sessionStorage.getItem(dismissKey) === signature) return;

  if (!window.confirm(confirmationText(project, changes))) {
    sessionStorage.setItem(dismissKey, signature);
    return;
  }

  const projects = [...container.projects];
  projects[index] = reconcileImportedProjectProductCategories(project);
  const nextValue = container.wrapped ? { ...container.parsed, projects } : projects;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  sessionStorage.removeItem(dismissKey);
  window.location.reload();
}

if (typeof window !== "undefined") {
  // Existing Business Cases are never silently rewritten. Once the current project is
  // loaded, incompatible product assignments are detected and the user is asked before
  // only those assignments are reconciled against the current catalogue.
  window.setTimeout(reconcileCurrentStoredProjectWithConfirmation, 1400);

  // After import/re-import, run the same controlled check. The existing import overwrite
  // confirmation still decides whether imported technical data may replace the project.
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;
    window.setTimeout(reconcileCurrentStoredProjectWithConfirmation, 1000);
    window.setTimeout(reconcileCurrentStoredProjectWithConfirmation, 2200);
  });
}
