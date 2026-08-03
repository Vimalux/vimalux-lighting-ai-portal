const timestamp = (project) => {
  const value = Date.parse(project?.updatedAt || project?.createdAt || "");
  return Number.isFinite(value) ? value : 0;
};

export function mergeProjectStates(localProjects = [], cloudProjects = []) {
  const merged = new Map();

  cloudProjects.forEach((project) => {
    if (project?.id) merged.set(project.id, project);
  });

  localProjects.forEach((project) => {
    if (!project?.id) return;
    const cloud = merged.get(project.id);
    if (!cloud || timestamp(project) > timestamp(cloud)) merged.set(project.id, project);
  });

  return [...merged.values()];
}
