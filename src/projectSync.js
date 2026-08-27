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
    if (!cloud) { merged.set(project.id, project); return; }
    const technicalSource = timestamp(project) > timestamp(cloud) ? project : cloud;
    const localCrmTime = Date.parse(project.crmUpdatedAt || ""), cloudCrmTime = Date.parse(cloud.crmUpdatedAt || "");
    const crmSource = Number.isFinite(localCrmTime) || Number.isFinite(cloudCrmTime) ? (Number.isFinite(localCrmTime) && (!Number.isFinite(cloudCrmTime) || localCrmTime > cloudCrmTime) ? project : cloud) : technicalSource;
    merged.set(project.id, { ...technicalSource, crm: crmSource.crm, crmUpdatedAt: crmSource.crmUpdatedAt || "" });
  });

  return [...merged.values()];
}
