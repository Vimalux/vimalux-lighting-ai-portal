import { migrateProject } from "./model.js";
import { saveCloudState, supabaseConfigured } from "./supabase.js";

const ROOT_ID = "vimalux-smart-service-periods";

function localProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch {
    return [];
  }
}

function activeIdentity() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("business_case_id") || "";
  const visibleCode = String(document.querySelector("main header small")?.textContent || "").trim();
  return { caseId, visibleCode };
}

function activeIndex(projects) {
  const { caseId, visibleCode } = activeIdentity();
  return projects.findIndex((project) =>
    (caseId && [project?.id, project?.crm?.businessCaseRecordId].map(String).includes(caseId)) ||
    (visibleCode && String(project?.project?.businessCaseId || "").trim() === visibleCode)
  );
}

function numeric(value, fallback) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

async function savePeriods(root) {
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) throw new Error("Business Case attivo non trovato.");

  const project = projects[index];
  const cmsInput = root.querySelector("[data-cms-years]");
  const powerInput = root.querySelector("[data-poweraid-years]");
  const currentCms = Math.max(1, Math.round(Number(project?.assumptions?.serviceAgreementPeriod) || 10));
  const cmsYears = numeric(cmsInput?.value, currentCms);
  const requestedPowerAid = numeric(powerInput?.value, Math.min(10, cmsYears));
  const powerAidYears = Math.min(cmsYears, requestedPowerAid);

  const updated = migrateProject({
    ...project,
    assumptions: {
      ...(project.assumptions || {}),
      serviceAgreementPeriod: cmsYears,
      contractYears: cmsYears,
      powerAidServicePeriod: powerAidYears,
    },
    updatedAt: new Date().toISOString(),
  });
  projects[index] = updated;
  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));

  const status = root.querySelector("[data-service-period-status]");
  if (status) status.textContent = "Salvataggio...";
  if (supabaseConfigured) await saveCloudState(projects);
  if (status) status.textContent = "Salvato";
  window.location.reload();
}

function findLegacyServiceField() {
  return [...document.querySelectorAll("label")].find((label) => {
    const text = String(label.querySelector("span")?.textContent || "").trim();
    return /periodo accordo servizi|service agreement period|service period/i.test(text);
  });
}

function render() {
  if (document.getElementById(ROOT_ID)) return;
  const legacy = findLegacyServiceField();
  if (!legacy) return;
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) return;
  const project = projects[index];
  const cmsYears = Math.max(1, Math.round(Number(project?.assumptions?.serviceAgreementPeriod) || 10));
  const powerAidYears = Math.max(1, Math.min(cmsYears, Math.round(Number(project?.assumptions?.powerAidServicePeriod) || Math.min(10, cmsYears))));
  const powerAidEnabled = Boolean(project?.solution?.powerAidEnabled);
  const it = project?.language !== "en";

  legacy.style.display = "none";
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText = "grid-column:1/-1;border:1px solid #cbd7e3;border-radius:10px;padding:12px;background:#f8fafc;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:end";
  root.innerHTML = `
    <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#40566d">
      <span>${it ? "Durata servizi CMS (anni)" : "CMS service period (years)"}</span>
      <input data-cms-years inputmode="numeric" value="${cmsYears}" style="border:1px solid #cbd7e3;border-radius:8px;padding:9px 10px;font:inherit;background:#fff">
    </label>
    <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#40566d;${powerAidEnabled ? "" : "opacity:.55"}">
      <span>${it ? "Durata PowerAiD (anni)" : "PowerAiD service period (years)"}</span>
      <input data-poweraid-years inputmode="numeric" value="${powerAidYears}" ${powerAidEnabled ? "" : "disabled"} style="border:1px solid #cbd7e3;border-radius:8px;padding:9px 10px;font:inherit;background:#fff">
    </label>
    <div style="grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;align-items:center">
      <small style="color:#64748b">${it ? "PowerAiD non può superare la durata CMS. Dopo la scadenza CMS cessano CLO, risparmio manutenzione e servizi Smart; il risparmio LED continua." : "PowerAiD cannot exceed the CMS term. After CMS expiry, CLO, maintenance saving and Smart services end; LED saving continues."}</small>
      <div style="display:flex;gap:10px;align-items:center;flex:0 0 auto">
        <small data-service-period-status style="color:#64748b"></small>
        <button type="button" data-save-service-periods class="primary">${it ? "Salva durate" : "Save periods"}</button>
      </div>
    </div>`;
  legacy.parentElement?.appendChild(root);
  root.querySelector("[data-save-service-periods]")?.addEventListener("click", async () => {
    const button = root.querySelector("[data-save-service-periods]");
    if (button) button.disabled = true;
    try {
      await savePeriods(root);
    } catch (error) {
      const status = root.querySelector("[data-service-period-status]");
      if (status) status.textContent = error?.message || "Errore";
      if (button) button.disabled = false;
    }
  });
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
}
