import { migrateProject } from "./model.js";
import { saveCloudState, supabaseConfigured } from "./supabase.js";
import { financingCashflowAdvisor } from "./financingAdvisor.js";

const ROOT_ID = "vimalux-financing-advisor";
const MONTHLY_OVERRIDE_ID = "vimalux-laas-monthly-override";

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

function dealTypeFromUi(project) {
  const label = findField(/tipo\s+di\s+accordo|deal\s+type/i);
  const select = label?.control || (label?.htmlFor ? document.getElementById(label.htmlFor) : null) || label?.nextElementSibling || label?.parentElement?.querySelector("select");
  const value = String(select?.value || "").toLowerCase();
  const optionText = String(select?.selectedOptions?.[0]?.textContent || "").toLowerCase();
  const combined = `${value} ${optionText}`;
  if (/noleggio|laas|tutto\s+incluso/.test(combined)) return "noleggio_operativo";
  if (/finanz|finance/.test(combined)) return "finance";
  if (/cash|acquisto/.test(combined)) return "cash";
  return project?.assumptions?.dealType || (project?.assumptions?.financingModel === "finance" ? "finance" : ["laas", "ppp"].includes(project?.assumptions?.financingModel) ? "noleggio_operativo" : "cash");
}

function projectForVisibleDealType(project) {
  const dealType = dealTypeFromUi(project);
  return {
    ...project,
    assumptions: {
      ...(project.assumptions || {}),
      dealType,
      financingModel: dealType === "finance" ? "finance" : dealType === "noleggio_operativo" ? "laas" : "cash",
    },
  };
}

function money(project, value) {
  const locale = project?.language === "it" ? "it-IT" : "en-GB";
  const currency = String(project?.project?.currency || "EUR").toUpperCase();
  try { return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0); }
  catch { return `${Math.round(Number(value) || 0)} ${currency}`; }
}

function parseLocalizedNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function persistProjects(projects) {
  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));
  if (supabaseConfigured) await saveCloudState(projects);
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
  const status = root.querySelector("[data-financing-advisor-status]");
  if (status) status.textContent = project?.language === "it" ? "Salvataggio..." : "Saving...";
  await persistProjects(projects);
  window.location.reload();
}

async function applyMonthlyOverride(projects, index, monthlyValue, statusNode) {
  const project = projects[index];
  const monthly = parseLocalizedNumber(monthlyValue);
  const assumptions = {
    ...(project.assumptions || {}),
    allInclusiveAnnualPayment: monthly > 0 ? monthly * 12 : 0,
  };
  projects[index] = migrateProject({ ...project, assumptions, updatedAt: new Date().toISOString() });
  if (statusNode) statusNode.textContent = project?.language === "it" ? "Salvataggio..." : "Saving...";
  await persistProjects(projects);
  window.location.reload();
}

function syncNoleggioPresentation(projects, index, project, isNoleggio, it) {
  const financeField = findField(/periodo\s+(?:di\s+)?finanziamento|durata\s+(?:del\s+)?finanziamento|financing\s+period/i);
  if (financeField) financeField.style.display = isNoleggio ? "none" : "";

  const annualField = findField(/canone\s+annuo\s+tutto\s+incluso|all-inclusive\s+annual\s+payment/i);
  const existingOverride = document.getElementById(MONTHLY_OVERRIDE_ID);

  if (!isNoleggio) {
    if (annualField) annualField.style.display = "";
    if (existingOverride) existingOverride.remove();
  } else if (annualField) {
    annualField.style.display = "none";
    if (!existingOverride) {
      const storedAnnual = Number(project?.assumptions?.allInclusiveAnnualPayment || 0);
      const wrapper = document.createElement("label");
      wrapper.id = MONTHLY_OVERRIDE_ID;
      wrapper.style.display = "grid";
      wrapper.style.gap = "6px";
      wrapper.innerHTML = `<span>${it ? "Canone mensile tutto incluso – override manuale" : "Monthly all-inclusive payment – manual override"}</span><input inputmode="decimal" value="${storedAnnual > 0 ? String((storedAnnual / 12).toFixed(2)) : ""}" placeholder="${it ? "Automatico" : "Automatic"}" /><small style="color:#64748b">${it ? "Lascia vuoto o 0 per usare il calcolo automatico. L'importo inserito viene applicato a TCV, cash flow, VAN e report." : "Leave blank or 0 to use the automatic calculation. The entered amount is applied to TCV, cash flow, NPV and reports."}</small><small data-laas-override-status style="color:#64748b"></small>`;
      annualField.parentElement?.insertBefore(wrapper, annualField);
      const input = wrapper.querySelector("input");
      const status = wrapper.querySelector("[data-laas-override-status]");
      input?.addEventListener("change", async () => {
        try { await applyMonthlyOverride(projects, index, input.value, status); }
        catch (error) { if (status) status.textContent = error?.message || "Errore"; }
      });
    }
  }

  document.querySelectorAll(".kpi span").forEach((span) => {
    const text = String(span.textContent || "").trim();
    if (!span.dataset.originalKpiLabel && /^(OPEX annuo per apparecchio|Annual OPEX per luminaire)$/i.test(text)) {
      span.dataset.originalKpiLabel = text;
    }
    if (!span.dataset.originalKpiLabel) return;
    const desired = isNoleggio
      ? (it ? "Quota servizi/OPEX inclusa / apparecchio / anno" : "Included service/OPEX share / luminaire / year")
      : span.dataset.originalKpiLabel;
    if (span.textContent !== desired) span.textContent = desired;
  });
}

function render() {
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) return;
  const storedProject = projects[index];
  const project = projectForVisibleDealType(storedProject);
  const advisor = financingCashflowAdvisor(project, { safetyMarginPercent: 10 });
  const newMode = advisor?.mode || "cash";
  const isNoleggio = newMode === "noleggio_operativo";
  const it = project?.language !== "en";

  syncNoleggioPresentation(projects, index, project, isNoleggio, it);

  const existingRoot = document.getElementById(ROOT_ID);
  const existingMode = existingRoot?.dataset?.mode || "";
  if (existingRoot && existingMode !== newMode) existingRoot.remove();
  else if (existingRoot) return;

  if (!advisor) return;
  const financeField = findField(/periodo\s+(?:di\s+)?finanziamento|durata\s+(?:del\s+)?finanziamento|financing\s+period/i);
  const serviceField = findField(/durata\s+servizi\s+cms|periodo\s+accordo\s+servizi|service\s+agreement\s+period|cms\s+service\s+period/i);
  const anchor = isNoleggio ? (serviceField || financeField) : financeField;
  if (!anchor) return;

  const minimum = advisor.minimum;
  const recommended = advisor.recommended;
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.dataset.mode = advisor.mode;
  root.style.cssText = "grid-column:1/-1;border:1px solid #bfdbfe;border-radius:10px;padding:14px;background:#eff6ff;display:grid;gap:10px";

  const title = isNoleggio
    ? (it ? "Durata Noleggio / LaaS cashflow-neutral" : "Cashflow-neutral Noleggio / LaaS duration")
    : (it ? "Durata finanziamento cashflow-neutral" : "Cashflow-neutral financing duration");

  if (!minimum) {
    root.innerHTML = `<div style="display:grid;gap:4px"><strong style="color:#0f6fae">${title}</strong><span style="font-size:12px;color:#475569">${isNoleggio
      ? (it ? `Nessuna durata tra ${advisor.minimumYears} e ${advisor.maximumYears} anni mantiene il cashflow cliente ≥ 0 con canone all-inclusive. Nel Noleggio il periodo di riferimento è la durata dell'accordo servizi/contratto.` : `No duration between ${advisor.minimumYears} and ${advisor.maximumYears} years keeps customer cash flow ≥ 0 with the all-inclusive payment. In Noleggio, the governing period is the service/contract duration.`)
      : (it ? `Nessuna durata tra 1 e ${advisor.serviceYears} anni mantiene il cashflow cliente ≥ 0 includendo OPEX ricorrente.` : `No duration between 1 and ${advisor.serviceYears} years keeps customer cash flow ≥ 0 including recurring OPEX.`)}</span></div>`;
  } else {
    const minYears = minimum.durationYears;
    const recYears = recommended.durationYears;
    const recommendedDifferent = recYears !== minYears;
    const year1Formula = isNoleggio
      ? (it ? `Anno 1: beneficio ${money(project, recommended.year1.grossBenefit)} − canone all-inclusive ${money(project, recommended.year1.allInclusivePayment)} = ${money(project, recommended.year1.netCashFlow)}.` : `Year 1: benefit ${money(project, recommended.year1.grossBenefit)} − all-inclusive payment ${money(project, recommended.year1.allInclusivePayment)} = ${money(project, recommended.year1.netCashFlow)}.`)
      : (it ? `Anno 1: beneficio ${money(project, recommended.year1.grossBenefit)} − finanziamento ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.` : `Year 1: benefit ${money(project, recommended.year1.grossBenefit)} − financing ${money(project, recommended.year1.financingPayment)} − OPEX ${money(project, recommended.year1.recurringOpex)} = ${money(project, recommended.year1.netCashFlow)}.`);
    const note = isNoleggio
      ? (it ? `Nel Noleggio il canone comprende CAPEX e servizi/OPEX: l'OPEX non viene sottratto una seconda volta. La durata applicata allinea contratto, CMS, analisi e Adaptive Dimming (se attivo).` : `For Noleggio, the payment includes CAPEX and services/OPEX, so OPEX is not deducted twice. Applying a duration aligns contract, CMS, analysis and Adaptive Dimming (if active).`)
      : (it ? `Verifica anno per anno sull'intero periodo servizi di ${advisor.serviceYears} anni.` : `Checked year by year across the full ${advisor.serviceYears}-year service period.`);

    root.innerHTML = `<div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap"><div style="display:grid;gap:5px"><strong style="color:#0f6fae">${title}</strong><span style="font-size:13px;color:#0f172a"><b>${it ? "Minimo" : "Minimum"}: ${minYears} ${it ? "anni" : "years"}</b> · ${it ? "cashflow annuo minimo" : "minimum annual cash flow"}: ${money(project, minimum.minAnnualCashFlow)}</span><span style="font-size:13px;color:#0f172a"><b>${it ? "Consigliato" : "Recommended"}: ${recYears} ${it ? "anni" : "years"}</b> · ${it ? "margine di sicurezza target" : "target safety margin"}: ${advisor.safetyMarginPercent}%</span><span style="font-size:12px;color:#475569">${year1Formula}</span><span style="font-size:11px;color:#64748b">${note}</span></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" data-apply-minimum class="secondary">${it ? `Applica minimo ${minYears} anni` : `Apply minimum ${minYears} years`}</button>${recommendedDifferent ? `<button type="button" data-apply-recommended class="primary">${it ? `Applica consigliato ${recYears} anni` : `Apply recommended ${recYears} years`}</button>` : ""}<small data-financing-advisor-status style="color:#64748b"></small></div></div>`;
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

function scheduleRender() {
  [0, 80, 250, 600].forEach((delay) => setTimeout(render, delay));
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target?.tagName === "SELECT") scheduleRender();
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
  else scheduleRender();
}
