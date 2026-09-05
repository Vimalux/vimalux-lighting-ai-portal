const safeSession = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function catalogueExpandedStateKey(project = {}) {
  const id = project?.crm?.businessCaseRecordId || project?.project?.businessCaseId || project?.id || "default";
  return `vimalux:catalogue-expanded:${id}`;
}

export function loadCatalogueExpandedState(project = {}) {
  const storage = safeSession();
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(catalogueExpandedStateKey(project)) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCatalogueExpandedState(project = {}, expanded = {}) {
  const storage = safeSession();
  if (!storage) return;
  try {
    storage.setItem(catalogueExpandedStateKey(project), JSON.stringify(expanded || {}));
  } catch {
    // UI continuity must never block catalogue editing.
  }
}
