import { isArchivedProject } from "./projectVisibility.js";

const text = (value) => String(value || "").trim().toUpperCase();
const identity = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/^comune\s+di\s+/i, "")
  .replace(/[^a-z0-9]+/g, "");

export function findActiveSuccessor(projects = [], candidate = null) {
  if (!candidate || !isArchivedProject(candidate)) return null;

  const predecessorCode = text(candidate?.project?.businessCaseId);
  if (!predecessorCode) return null;

  const customer = identity(candidate?.customer?.name);
  const projectName = identity(candidate?.project?.name || candidate?.name);

  return (Array.isArray(projects) ? projects : []).find((project) => {
    if (!project || project.id === candidate.id || isArchivedProject(project)) return false;
    if (text(project?.crm?.legacyIntelligenceId) !== predecessorCode) return false;

    const sameCustomer = !customer || identity(project?.customer?.name) === customer;
    const sameProject = !projectName || identity(project?.project?.name || project?.name) === projectName;
    return sameCustomer && sameProject;
  }) || null;
}

export function preferredProject(projects = [], candidate = null) {
  return findActiveSuccessor(projects, candidate) || candidate || null;
}

export function supersededByLabel(projects = [], candidate = null) {
  const successor = findActiveSuccessor(projects, candidate);
  return successor?.project?.businessCaseId || "";
}
