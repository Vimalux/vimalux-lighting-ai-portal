export function changedProjects(previous = [], current = []) {
  const before = new Map((Array.isArray(previous) ? previous : []).map((project) => [project?.id, project]));
  return (Array.isArray(current) ? current : []).filter((project) => before.get(project?.id) !== project);
}
