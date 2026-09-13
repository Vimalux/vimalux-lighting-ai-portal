import { migrateProject } from "./model.js";
import { saveCloudState, supabaseConfigured } from "./supabase.js";
import { financingCashflowAdvisor } from "./financingAdvisor.js";

const ROOT_ID = "vimalux-financing-advisor";

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

function findFinancingField() {
  return [...document.querySelectorAll("label")].find((label) => {
    const text = String(label.querySelector("span")?.textContent || "").trim();
    return /periodo finanziamento|durata finanziamento|financing period/i.test(text);
  });
}

function money(project, value) {
  const locale = project?.language === "it" ? "it-IT" : "en-GB";
  const currency = String(project?.project?.currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch {
    return `${Math.round(Number(value) || 0)} ${currency}`;
  }
}

async function applyDuration(projects, index, duration, root) {
  const project = projects[index];
  const updated = migrateProject({
    ...project,
    assumptions: {
      ...(project.assumptions || {}),
      financingPeriod: duration,
      financingYears: duration,
    },
    updatedAt: new Date().toISOString(),
  });
  projects[index] = updated;
  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));
  const status = root.querySelector("[data-financing-advisor-status]");
  if (status) status.textContent = project?.language === "it" ? "Salvataggio..." : "Saving...";
  if (supabaseConfigured) await saveCloudState(projects);
  window.location.reload();
}

function render() {
  if (document.getElementById(ROOT_ID)) return;
  const financingField = findFinancingField();
  if (!financingField) return;
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) return;
  const project = projects[index];

  const advisor = financingCashflowAdvisor(project, { safetyMarginPercent: 10 });
  if (!advisor) return;
  const it = project?.language !== "en";
  const minimum = advisor.minimum;
  const recommended = advisor.recommended;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText = "grid-column:1/-1;border:1px solid #bfdbfe;border-radius:10px;padding:14px;background:#eff6ff;display:grid;gap:10px";

  if (!minimum) {
    root.innerHTML = `
      <div style="display:grid;gap:4px">
        <strong style="color:#0f6fae">${it ? "Durata finanziamento cashflow-neutral" : "Cashflow-neutral financing duration"}</strong>
        <span style="font-size:12px;color:#475569">${it ? `Nessuna durata tra 1 e ${advisor.serviceYears} anni mantiene il cashflow cliente ≥ 0 in ogni anno del contratto, includendo OPEX ricorrente.` : `No duration between 1 and ${advisor.serviceYears} years keeps customer cash flow ≥ 0 in every contract year, including recurring OPEX.`}</span>
      </div>`;
  } else {
    const recommendedDifferent = recommended && recommended.financingYears !== minimum.financingYears;
    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
        <div style="display:grid;gap:5px">
          <strong style="color:#0f6fae">${it ? "Durata finanziamento cashflow-neutral" : "Cashflow-neutral financing duration"}</strong>
          <span style="font-size:13px;color:#0f172a"><b>${it ? "Minimo" : "Minimum"}: ${minimum.financingYears} ${it ? "anni" : "years"}</b> · ${it ? "cashflow annuo minimo" : "minimum annual cash flow"}: ${money(project, minimum.minAnnualCashFlow)}</span>
          <span style="font-size:13px;color:#0f172a"><b>${it ? "Consigliato" : "Recommended"}: ${recommended.financingYears} ${it ? "anni" : "years"}</b> · ${it ? "margine di sicurezza target" : "target safety margin"}: ${advisor.safetyMarginPercent}%</span>
          <span style="font-size:12px;color:#475569">${it ? `Anno 1: beneficio ${money(project, recommended.year1.grossBenefit)} − finanziamento ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.` : `Year 1: benefit ${money(project, recommended.year1.grossBenefit)} − financing ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.`}</span>
          <span style="font-size:11px;color:#64748b">${it ? `Verifica effettuata anno per anno sull'intero periodo servizi di ${advisor.serviceYears} anni. Un eventuale canone manuale/importato non viene sovrascritto dal calcolo di consulenza.` : `Checked year by year across the full ${advisor.serviceYears}-year service period. Any manual/imported canone is not overwritten by the advisory calculation.`}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button type="button" data-apply-minimum class="secondary">${it ? `Applica minimo ${minimum.financingYears} anni` : `Apply minimum ${minimum.financingYears} years`}</button>
          ${recommendedDifferent ? `<button type="button" data-apply-recommended class="primary">${it ? `Applica consigliato ${recommended.financingYears} anni` : `Apply recommended ${recommended.financingYears} years`}</button>` : ""}
          <small data-financing-advisor-status style="color:#64748b"></small>
        </div>
      </div>`;
  }

  financingField.parentElement?.appendChild(root);
  root.querySelector("[data-apply-minimum]")?.addEventListener("click", async () => {
    try { await applyDuration(projects, index, minimum.financingYears, root); }
    catch (error) { const status = root.querySelector("[data-financing-advisor-status]"); if (status) status.textContent = error?.message || "Errore"; }
  });
  root.querySelector("[data-apply-recommended]")?.addEventListener("click", async () => {
    try { await applyDuration(projects, index, recommended.financingYears, root); }
    catch (error) { const status = root.querySelector("[data-financing-advisor-status]"); if (status) status.textContent = error?.message || "Errore"; }
  });
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
}
