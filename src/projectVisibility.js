export function isArchivedProject(project) {
  return String(project?.crm?.status || "").toLowerCase() === "archived" || Boolean(project?.crm?.archivedAt);
}

export function activeIntelligenceProjects(projects = []) {
  return projects.filter((project) => !isArchivedProject(project));
}
