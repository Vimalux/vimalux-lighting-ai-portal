import { calculateBusinessCase } from "./calculations.js";
import { needsAutomaticHybridSolar, projectMunicipalityCandidates } from "./hybridSolarAuto.js";
import { getLiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT, publishLiveBusinessCaseResult } from "./liveBusinessCaseResult.js";
import { resolveMunicipalitySolar } from "./solarLocation.js";
import { publishHybridSolarAutoStatus } from "./hybridSolarAutoStatus.js";
import { loadCurrentProfile, saveCloudState } from "./supabase.js";

const attempted = new Set();
let scheduled = false;
const VIMALUX_WRITE_ROLES = new Set(["admin", "vimalux", "sales_manager"]);

async function resolveMunicipalityFromCandidates(project) {
  const candidates = projectMunicipalityCandidates(project);
  let lastError = null;
  for (const municipality of candidates) {
    try {
      return await resolveMunicipalitySolar(municipality, {
        countryCode: String(project?.customer?.country || "Italia").toLowerCase().includes("ital") ? "IT" : "",
        language: project?.language || "it",
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No municipality candidate could be resolved.");
}

async function resolveForCurrentBusinessCase() {
  const live = getLiveBusinessCaseResult(window.location.search);
  if (!live || !needsAutomaticHybridSolar(live.project, live.result)) return;

  const project = live.project;
  const candidates = projectMunicipalityCandidates(project);
  const primary = candidates[0] || "";
  const key = `${project.id || project?.project?.businessCaseId || "project"}:${candidates.join("|").toLowerCase()}`;
  if (attempted.has(key)) return;
  attempted.add(key);

  try {
    const profile = await loadCurrentProfile();
    const role = String(profile?.role || "").toLowerCase();
    if (!VIMALUX_WRITE_ROLES.has(role)) {
      publishHybridSolarAutoStatus({
        state: "blocked",
        municipality: primary,
        role,
        message: `Automatic solar calculation is blocked for role: ${role || "unknown"}`,
      });
      return;
    }

    publishHybridSolarAutoStatus({
      state: "resolving",
      municipality: primary,
      role,
      message: candidates.length ? `Resolving municipality: ${candidates.join(" → ")}` : "No municipality candidate found",
    });

    const location = await resolveMunicipalityFromCandidates(project);

    project.assumptions = {
      ...(project.assumptions || {}),
      hybridSolarLocation: location,
      hybridSolarYieldKwhPerKwp: location.annualYieldKwhPerKwp,
    };
    project.updatedAt = new Date().toISOString();

    await saveCloudState([project]);
    const recalculated = calculateBusinessCase(project);
    publishLiveBusinessCaseResult(project, recalculated);
    publishHybridSolarAutoStatus({
      state: "ready",
      municipality: location.resolvedName || location.query || primary,
      role,
      message: `Solar yield resolved: ${Math.round(Number(location.annualYieldKwhPerKwp || 0))} kWh/kWp/year`,
    });

    const reloadKey = `vimalux-hybrid-solar-reload:${project.id || key}`;
    if (sessionStorage.getItem(reloadKey) !== location.calculatedAt) {
      sessionStorage.setItem(reloadKey, location.calculatedAt);
      window.location.reload();
    }
  } catch (error) {
    attempted.delete(key);
    publishHybridSolarAutoStatus({
      state: "error",
      municipality: primary,
      message: error?.message || String(error),
    });
    console.warn("VIMALUX automatic municipality solar calculation failed", { candidates, error });
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
