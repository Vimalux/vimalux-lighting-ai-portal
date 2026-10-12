const PREFIX = "vimalux-navigation-v2";
export const ADMIN_VIEWS = new Set([
  "customer", "existing", "solution", "additionalCosts", "pricing", "assumptions",
  "business", "report", "orderList", "crm", "datek", "partnerReports", "projects",
  "catalogue", "admin", "internalReport",
]);

export function navigationKey(userId, projectId) {
  return `${PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
}

function isArchived(project) {
  return String(project?.crm?.status || "").toLowerCase() === "archived" || Boolean(project?.crm?.archivedAt);
}

function normalizeIdentity(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^comune\s+di\s+/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function activeSuccessor(projects, matched) {
  if (!matched || !isArchived(matched)) return matched;
  const predecessorCode = String(matched?.project?.businessCaseId || "").trim().toUpperCase();
  if (!predecessorCode) return matched;

  const customer = normalizeIdentity(matched?.customer?.name);
  const projectName = normalizeIdentity(matched?.project?.name || matched?.name);

  return projects.find((item) => {
    if (!item || item.id === matched.id || isArchived(item)) return false;
    if (String(item?.crm?.legacyIntelligenceId || "").trim().toUpperCase() !== predecessorCode) return false;
    const sameCustomer = !customer || normalizeIdentity(item?.customer?.name) === customer;
    const sameProject = !projectName || normalizeIdentity(item?.project?.name || item?.name) === projectName;
    return sameCustomer && sameProject;
  }) || matched;
}

export function findLinkedProject(projects, businessCaseId, opportunityId) {
  if (businessCaseId) {
    const matched = projects.find((item) => [
      item.id,
      item.crm?.businessCaseRecordId,
      item.crm?.legacyIntelligenceId,
      item.project?.businessCaseId,
    ].includes(businessCaseId));
    return activeSuccessor(projects, matched);
  }
  return opportunityId ? projects.find((item) =>
    [item.crm?.opportunityId, item.crm?.uniqueProjectId].includes(opportunityId)) : undefined;
}

export function readNavigation(storage, key, allowedViews) {
  try {
    const view = storage.getItem(key);
    return allowedViews.has(view) ? view : "customer";
  } catch {
    return "customer";
  }
}

export function writeNavigation(storage, key, view, allowedViews) {
  if (!allowedViews.has(view)) return;
  try { storage.setItem(key, view); } catch { /* Navigation still works in memory. */ }
}
