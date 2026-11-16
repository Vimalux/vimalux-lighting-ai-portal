// Compatibility adapter for legacy DOM enhancements. Agents use React's
// in-memory cloud snapshot, never persistent browser project storage.
let agentMode = false;
let agentProjects = [];

export function setRuntimeProjectSnapshot(projects, { agent = false } = {}) {
  agentMode = Boolean(agent);
  agentProjects = agentMode ? [...(projects || [])] : [];
}

export function isAgentRuntime() { return agentMode; }

export function readRuntimeProjects() {
  if (agentMode) return [...agentProjects];
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.projects) ? parsed.projects : [];
  } catch { return []; }
}

export function writeRuntimeProjects(projects) {
  if (agentMode) {
    agentProjects = [...(projects || [])];
    return;
  }
  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));
}
