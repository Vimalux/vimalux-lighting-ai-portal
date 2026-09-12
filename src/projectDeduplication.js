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
  if (!customer && !projectName && !fileName) return "";
  return [customer, projectName, fileName].join("|");
}

export function isSameImportedProject(a, b) {
  const aIdentity = projectImportIdentity(a);
  const bIdentity = projectImportIdentity(b);
  return Boolean(aIdentity && bIdentity && aIdentity === bIdentity);
}

export function dedupeProjects(projects = []) {
  const byCloudId = new Map();
  const byImportIdentity = new Map();
  const result = [];

  for (const project of projects) {
    const cloudId = isStableCloudId(project?.id) ? String(project.id) : "";
    const identity = projectImportIdentity(project);

    if (cloudId && byCloudId.has(cloudId)) continue;

    if (identity && byImportIdentity.has(identity)) {
      const existingIndex = byImportIdentity.get(identity);
      const existing = result[existingIndex];
      const existingStable = isStableCloudId(existing?.id);
      const currentStable = isStableCloudId(project?.id);
      if (!existingStable && currentStable) {
        result[existingIndex] = project;
        if (cloudId) byCloudId.set(cloudId, existingIndex);
      }
      continue;
    }

    const index = result.length;
    result.push(project);
    if (cloudId) byCloudId.set(cloudId, index);
    if (identity) byImportIdentity.set(identity, index);
  }

  return result;
}
