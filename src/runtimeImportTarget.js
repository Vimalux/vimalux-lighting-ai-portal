import { isAgentRuntime } from "./runtimeProjectStore.js";

const KEY = "vimalux-reimport-target-id";
let agentTarget = "";

export function readRuntimeImportTarget() {
  if (isAgentRuntime()) return agentTarget;
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function setRuntimeImportTarget(value) {
  if (isAgentRuntime()) {
    agentTarget = String(value || "");
    return;
  }
  try { localStorage.setItem(KEY, String(value || "")); } catch { /* No browser storage. */ }
}

export function clearRuntimeImportTarget() {
  if (isAgentRuntime()) {
    agentTarget = "";
    return;
  }
  try { localStorage.removeItem(KEY); } catch { /* No browser storage. */ }
}
