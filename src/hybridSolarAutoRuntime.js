import { calculateBusinessCase } from "./calculations.js";
import { needsAutomaticHybridSolar, projectMunicipalityName } from "./hybridSolarAuto.js";
import { getLiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT, publishLiveBusinessCaseResult } from "./liveBusinessCaseResult.js";
import { resolveMunicipalitySolar } from "./solarLocation.js";
import { loadCurrentProfile, saveCloudState } from "./supabase.js";

const attempted = new Set();
let scheduled = false;

async function resolveForCurrentBusinessCase() {
  const live = getLiveBusinessCaseResult(window.location.search);
  if (!live || !needsAutomaticHybridSolar(live.project, live.result)) return;

  const project = live.project;
  const municipality = projectMunicipalityName(project);
  const key = `${project.id || project?.project?.businessCaseId || "project"}:${municipality.toLowerCase()}`;
  if (attempted.has(key)) return;
  attempted.add(key);

  try {
    const profile = await loadCurrentProfile();
    // Keep the existing fail-closed permission model: automatic project writes are admin-only.
    if (profile?.role !== "admin") return;

    const location = await resolveMunicipalitySolar(municipality, {
      countryCode: String(project?.customer?.country || "Italia").toLowerCase().includes("ital") ? "IT" : "",
      language: project?.language || "it",
    });

    // The live project is the same object currently held by Intelligence. Update only the
    // solar assumptions, persist immediately, recalculate, then reload once from Supabase so
    // React state and the persisted Business Case are guaranteed to converge.
    project.assumptions = {
      ...(project.assumptions || {}),
      hybridSolarLocation: location,
      hybridSolarYieldKwhPerKwp: location.annualYieldKwhPerKwp,
    };
    project.updatedAt = new Date().toISOString();

    await saveCloudState([project]);
    publishLiveBusinessCaseResult(project, calculateBusinessCase(project));

    const reloadKey = `vimalux-hybrid-solar-reload:${project.id || key}`;
    if (sessionStorage.getItem(reloadKey) !== location.calculatedAt) {
      sessionStorage.setItem(reloadKey, location.calculatedAt);
      window.location.reload();
    }
  } catch (error) {
    attempted.delete(key);
    console.warn("VIMALUX automatic municipality solar calculation failed", error);
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    resolveForCurrentBusinessCase();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener(LIVE_BUSINESS_CASE_EVENT, schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  schedule();
}
