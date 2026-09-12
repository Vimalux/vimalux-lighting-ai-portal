const PREFIX = "vimalux-navigation-v2";
export const ADMIN_VIEWS = new Set([
  "customer", "existing", "solution", "additionalCosts", "pricing", "assumptions",
  "business", "report", "orderList", "crm", "datek", "partnerReports", "projects",
  "catalogue", "admin", "internalReport",
]);

export function navigationKey(userId, projectId) {
  return `${PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}`;
}

export function findLinkedProject(projects, businessCaseId, opportunityId) {
  return projects.find((item) =>
    (businessCaseId && [
      item.id,
      item.crm?.businessCaseRecordId,
      item.crm?.legacyIntelligenceId,
      item.project?.businessCaseId,
    ].includes(businessCaseId)) ||
    (opportunityId && [item.crm?.opportunityId, item.crm?.uniqueProjectId].includes(opportunityId)),
  );
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
