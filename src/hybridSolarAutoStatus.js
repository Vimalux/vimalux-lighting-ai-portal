export const HYBRID_SOLAR_AUTO_STATUS_EVENT = "vimalux:hybrid-solar-auto-status";

export function publishHybridSolarAutoStatus(status = {}) {
  if (typeof window === "undefined") return;
  window.__vimaluxHybridSolarAutoStatus = {
    state: "idle",
    message: "",
    municipality: "",
    role: "",
    ...status,
    updatedAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent(HYBRID_SOLAR_AUTO_STATUS_EVENT, {
    detail: window.__vimaluxHybridSolarAutoStatus,
  }));
}

export function getHybridSolarAutoStatus() {
  if (typeof window === "undefined") return null;
  return window.__vimaluxHybridSolarAutoStatus || null;
}
