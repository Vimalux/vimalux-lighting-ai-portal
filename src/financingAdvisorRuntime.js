import { migrateProject } from "./model.js";
import { saveCloudState, supabaseConfigured } from "./supabase.js";
import { financingCashflowAdvisor } from "./financingAdvisor.js";

const ROOT_ID = "vimalux-financing-advisor";

function localProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch { return []; }
}

function activeIdentity() {
  const params = new URLSearchParams(window.location.search);
  return {
    caseId: params.get("business_case_id") || "",
    visibleCode: String(document.querySelector("main header small")?.textContent || "").trim(),
  };
}

function activeIndex(projects) {
  const { caseId, visibleCode } = activeIdentity();
  return projects.findIndex((project) =>
    (caseId && [project?.id, project?.crm?.businessCaseRecordId].map(String).includes(caseId)) ||
    (visibleCode && String(project?.project?.businessCaseId || "").trim() === visibleCode)
  );
}

function findField(pattern) {
  return [...document.querySelectorAll("label")].find((label) => pattern.test(String(label.textContent || "").replace(/\s+/g, " ").trim()));
}

function money(project, value) {
  const locale = project?.language === "it" ? "it-IT" : "en-GB";
  const currency = String(project?.project?.currency || "EUR").toUpperCase();
  try { return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0); }
  catch { return `${Math.round(Number(value) || 0)} ${currency}`; }
}

async function applyDuration(projects, index, duration, root, mode) {
  const project = projects[index];
  const assumptions = {
    ...(project.assumptions || {}),
    financingPeriod: duration,
    financingYears: duration,
  };
  if (mode === "noleggio_operativo") {
    assumptions.serviceAgreementPeriod = duration;
    assumptions.contractYears = duration;
    assumptions.analysisPeriod = duration;
    if (project?.solution?.powerAidEnabled) assumptions.powerAidServicePeriod = duration;
  }
  const updated = migrateProject({ ...project, assumptions, updatedAt: new Date().toISOString() });
  projects[index] = updated;
  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));
  const status = root.querySelector("[data-financing-advisor-status]");
  if (status) status.textContent = project?.language === "it" ? "Salvataggio..." : "Saving...";
  if (supabaseConfigured) await saveCloudState(projects);
  window.location.reload();
}

function render() {
  if (document.getElementById(ROOT_ID)) return;
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) return;
  const project = projects[index];
  const advisor = financingCashflowAdvisor(project, { safetyMarginPercent: 10 });
  if (!advisor) return;

  const financeField = findField(/periodo\s+(?:di\s+)?finanziamento|durata\s+(?:del\s+)?finanziamento|financing\s+period/i);
  const serviceField = findField(/durata\s+servizi\s+cms|periodo\s+accordo\s+servizi|service\s+agreement\s+period|cms\s+service\s+period/i);
  const isNoleggio = advisor.mode === "noleggio_operativo";
  const anchor = isNoleggio ? (serviceField || financeField) : financeField;
  if (!anchor) return;

  if (isNoleggio && financeField) financeField.style.display = "none";

  const it = project?.language !== "en";
  const minimum = advisor.minimum;
  const recommended = advisor.recommended;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.cssText = "grid-column:1/-1;border:1px solid #bfdbfe;border-radius:10px;padding:14px;background:#eff6ff;display:grid;gap:10px";

  const title = isNoleggio
    ? (it ? "Durata Noleggio / LaaS cashflow-neutral" : "Cashflow-neutral Noleggio / LaaS duration")
    : (it ? "Durata finanziamento cashflow-neutral" : "Cashflow-neutral financing duration");

  if (!minimum) {
    root.innerHTML = `<div style="display:grid;gap:4px">
      <strong style="color:#0f6fae">${title}</strong>
      <span style="font-size:12px;color:#475569">${isNoleggio
        ? (it ? `Nessuna durata tra ${advisor.minimumYears} e ${advisor.maximumYears} anni mantiene il cashflow cliente ≥ 0 con canone all-inclusive.` : `No duration between ${advisor.minimumYears} and ${advisor.maximumYears} years keeps customer cash flow ≥ 0 with the all-inclusive payment.`)
        : (it ? `Nessuna durata tra 1 e ${advisor.serviceYears} anni mantiene il cashflow cliente ≥ 0 includendo OPEX ricorrente.` : `No duration between 1 and ${advisor.serviceYears} years keeps customer cash flow ≥ 0 including recurring OPEX.`)}
      </span></div>`;
  } else {
    const minYears = minimum.durationYears;
    const recYears = recommended.durationYears;
    const recommendedDifferent = recYears !== minYears;
    const year1Formula = isNoleggio
      ? (it ? `Anno 1: beneficio ${money(project, recommended.year1.grossBenefit)} − canone all-inclusive ${money(project, recommended.year1.allInclusivePayment)} = ${money(project, recommended.year1.netCashFlow)}.` : `Year 1: benefit ${money(project, recommended.year1.grossBenefit)} − all-inclusive payment ${money(project, recommended.year1.allInclusivePayment)} = ${money(project, recommended.year1.netCashFlow)}.`)
      : (it ? `Anno 1: beneficio ${money(project, recommended.year1.grossBenefit)} − finanziamento ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.` : `Year 1: benefit ${money(project, recommended.year1.grossBenefit)} − financing ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.`);
    const note = isNoleggio
      ? (it ? `Nel Noleggio il canone comprende CAPEX e servizi/OPEX: l'OPEX non viene sottratto una seconda volta. Applicando una durata, contratto, CMS, analisi e Adaptive Dimming (se attivo) vengono allineati.` : `For Noleggio, the payment includes CAPEX and services/OPEX, so OPEX is not deducted twice. Applying a duration aligns contract, CMS, analysis and Adaptive Dimming (if active).`)
      : (it ? `Verifica anno per anno sull'intero periodo servizi di ${advisor.serviceYears} anni.` : `Checked year by year across the full ${advisor.serviceYears}-year service period.`);

    root.innerHTML = `<div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div style="display:grid;gap:5px">
        <strong style="color:#0f6fae">${title}</strong>
        <span style="font-size:13px;color:#0f172a"><b>${it ? "Minimo" : "Minimum"}: ${minYears} ${it ? "anni" : "years"}</b> · ${it ? "cashflow annuo minimo" : "minimum annual cash flow"}: ${money(project, minimum.minAnnualCashFlow)}</span>
        <span style="font-size:13px;color:#0f172a"><b>${it ? "Consigliato" : "Recommended"}: ${recYears} ${it ? "anni" : "years"}</b> · ${it ? "margine di sicurezza target" : "target safety margin"}: ${advisor.safetyMarginPercent}%</span>
        <span style="font-size:12px;color:#475569">${year1Formula}</span>
        <span style="font-size:11px;color:#64748b">${note}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" data-apply-minimum class="secondary">${it ? `Applica minimo ${minYears} anni` : `Apply minimum ${minYears} years`}</button>
        ${recommendedDifferent ? `<button type="button" data-apply-recommended class="primary">${it ? `Applica consigliato ${recYears} anni` : `Apply recommended ${recYears} years`}</button>` : ""}
        <small data-financing-advisor-status style="color:#64748b"></small>
      </div>
    </div>`;
  }

  anchor.parentElement?.appendChild(root);
  root.querySelector("[data-apply-minimum]")?.addEventListener("click", async () => {
    try { await applyDuration(projects, index, minimum.durationYears, root, advisor.mode); }
    catch (error) { const status = root.querySelector("[data-financing-advisor-status]"); if (status) status.textContent = error?.message || "Errore"; }
  });
  root.querySelector("[data-apply-recommended]")?.addEventListener("click", async () => {
    try { await applyDuration(projects, index, recommended.durationYears, root, advisor.mode); }
    catch (error) { const status = root.querySelector("[data-financing-advisor-status]"); if (status) status.textContent = error?.message || "Errore"; }
  });
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
}
