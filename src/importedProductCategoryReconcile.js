import { compatibleLedProducts, isCatalogueProductCompatible, normalizeProductCategory } from "./productCatalogue.js";

const STORAGE_KEY = "vimalux-intelligence-projects";
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
  if (!candidates.length) {
    return current ? { ...group, proposedProductId: "" } : group;
  }

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

export function reconcileImportedProjectProductCategories(project) {
  if (!project?.importedTechnical || !Array.isArray(project.groups)) return project;
  const ledProducts = Array.isArray(project.catalogue?.led) ? project.catalogue.led : [];
  if (!ledProducts.length) return project;
  let changed = false;
  const groups = project.groups.map((group) => {
    const next = reconcileImportedGroupProduct(group, ledProducts);
    if (next !== group && (
      next.proposedProductId !== group.proposedProductId ||
      next.projectLedWattage !== group.projectLedWattage
    )) changed = true;
    return next;
  });
  return changed ? { ...project, groups, updatedAt: new Date().toISOString() } : project;
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

function reconcileStoredProjects() {
  const container = readStoredContainer();
  if (!container.projects.length) return;
  let changed = false;
  const projects = container.projects.map((project) => {
    const reconciled = reconcileImportedProjectProductCategories(project);
    if (reconciled !== project) changed = true;
    return reconciled;
  });
  if (!changed) return;
  const nextValue = container.wrapped ? { ...container.parsed, projects } : projects;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

if (typeof window !== "undefined") {
  // Repair already-imported projects after the current project state has loaded.
  // The app's existing persistence/sync layer will then persist the corrected state.
  window.setTimeout(reconcileStoredProjects, 1200);

  // Re-run after an import/re-import. The existing confirmation guard decides whether
  // overwrite is allowed; this module only ensures the resulting product IDs obey the
  // selected luminaire category.
  document.addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;
    window.setTimeout(reconcileStoredProjects, 800);
    window.setTimeout(reconcileStoredProjects, 1800);
  });
}
