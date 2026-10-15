import { isStableCloudId } from "./businessCasePersistence.js";

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^comune\s+di\s+/i, "")
    .replace(/\.(xlsx?|csv)$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function projectImportIdentity(project) {
  const customer = normalize(project?.customer?.name);
  const projectName = normalize(project?.project?.name || project?.name);
  const fileName = normalize(project?.importedTechnical?.fileName || project?.importedCommercial?.fileName);
  if (fileName && customer) return `file:${customer}|${fileName}`;
  if (!customer && !projectName) return "";
  return `project:${customer}|${projectName}`;
}

export function isSameImportedProject(a, b) {
  const aIdentity = projectImportIdentity(a);
  const bIdentity = projectImportIdentity(b);
  return Boolean(aIdentity && bIdentity && aIdentity === bIdentity);
}

/**
 * Deduplicate only on durable identifiers by default.
 *
 * Customer/project/file-name identity is intentionally opt-in. It is useful
 * during an explicit user-driven re-import, but it must never be used during
 * cloud hydration, autosave, or normal project selection because two distinct
 * Business Cases can legitimately have the same customer/project name.
 */
export function dedupeProjects(projects = [], { dedupeImportIdentity = false } = {}) {
  const byCloudId = new Map();
  const byBusinessCaseRecordId = new Map();
  const byBusinessCaseCode = new Map();
  const byLegacyId = new Map();
  const byImportIdentity = new Map();
  const result = [];

  for (const project of projects) {
    const cloudId = isStableCloudId(project?.id) ? String(project.id) : "";
    const businessCaseRecordId = isStableCloudId(project?.crm?.businessCaseRecordId)
      ? String(project.crm.businessCaseRecordId)
      : "";
    const businessCaseCode = String(project?.project?.businessCaseId || "").trim().toUpperCase();
    const legacyId = String(project?.crm?.legacyIntelligenceId || "").trim();
    const identity = dedupeImportIdentity ? projectImportIdentity(project) : "";

    if (cloudId && byCloudId.has(cloudId)) continue;
    if (businessCaseRecordId && byBusinessCaseRecordId.has(businessCaseRecordId)) continue;
    if (businessCaseCode && byBusinessCaseCode.has(businessCaseCode)) continue;
    if (legacyId && byLegacyId.has(legacyId)) continue;

    if (identity && byImportIdentity.has(identity)) {
      const existingIndex = byImportIdentity.get(identity);
      const existing = result[existingIndex];
      const existingStable = isStableCloudId(existing?.id);
      const currentStable = isStableCloudId(project?.id);

      // During explicit import reconciliation a stable cloud project replaces a
      // matching local draft. Distinct stable cloud records are never collapsed.
      if (!existingStable && currentStable) {
        result[existingIndex] = project;
        if (cloudId) byCloudId.set(cloudId, existingIndex);
        if (businessCaseRecordId) byBusinessCaseRecordId.set(businessCaseRecordId, existingIndex);
        if (businessCaseCode) byBusinessCaseCode.set(businessCaseCode, existingIndex);
        if (legacyId) byLegacyId.set(legacyId, existingIndex);
        continue;
      }
      if (!existingStable || !currentStable) continue;
    }

    const index = result.length;
    result.push(project);
    if (cloudId) byCloudId.set(cloudId, index);
    if (businessCaseRecordId) byBusinessCaseRecordId.set(businessCaseRecordId, index);
    if (businessCaseCode) byBusinessCaseCode.set(businessCaseCode, index);
    if (legacyId) byLegacyId.set(legacyId, index);
    if (identity) byImportIdentity.set(identity, index);
  }

  return result;
}
