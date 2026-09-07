import { getLiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT } from "./liveBusinessCaseResult.js";

const MARKER = "data-vimalux-report-executive-refinement";

function safe(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function locale(language) {
  return language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";
}

function formatNumber(value, language, digits = 0) {
  return new Intl.NumberFormat(locale(language), {
    useGrouping: "always",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe(value));
}

function formatMoney(value, language, currency = "EUR") {
  return new Intl.NumberFormat(locale(language), {
    style: "currency",
    currency,
    useGrouping: "always",
    maximumFractionDigits: 0,
  }).format(safe(value));
}

function hybridStats(result) {
  const hybrid = result?.hybridSolar || {};
  if (!hybrid.enabled) return null;
  const installedPvKwp = (Array.isArray(hybrid.rows) ? hybrid.rows : []).reduce(
    (sum, row) => sum + Math.max(0, safe(row?.quantity)) * Math.max(0, safe(row?.pvWp)) / 1000,
    0,
  );
  return {
    units: Math.max(0, safe(hybrid.totalHybridUnits)),
    installedPvKwp,
    gridOffsetKwh: Math.max(0, safe(result?.hybridSolarSavingKwh)),
    benefitEur: Math.max(0, safe(result?.hybridSolarSavingEUR)),
  };
}

function makeKpi(label, value, markerValue) {
  const item = document.createElement("div");
  item.className = "kpi";
  item.setAttribute(MARKER, markerValue);
  const span = document.createElement("span");
  const strong = document.createElement("strong");
  span.textContent = label;
  strong.textContent = value;
  item.append(span, strong);
  return item;
}

function renderExecutiveRefinement(report, project, result) {
  report.querySelectorAll(`[${MARKER}]`).forEach((node) => node.remove());
  const summary = report.querySelector(".customer-summary-card");
  if (!summary) return;

  const language = project?.language || "it";
  const currency = project?.project?.currency || "EUR";
  const it = language === "it";
  const energyEscalation = safe(project?.assumptions?.energyEscalation);
  const opexEscalation = safe(project?.assumptions?.opexEscalation);
  const hybrid = hybridStats(result);

  const kpis = summary.querySelector(".customer-summary-kpis");
  if (hybrid && kpis) {
    kpis.appendChild(makeKpi(
      "Hybrid Solar",
      `${formatNumber(hybrid.units, language)} · ${formatMoney(hybrid.benefitEur, language, currency)}/${it ? "anno" : "yr"}`,
      "hybrid-kpi",
    ));
  }

  const section = document.createElement("section");
  section.className = "card customer-summary-card report-model-assumptions";
  section.setAttribute(MARKER, "model-card");
  const title = document.createElement("h2");
  title.textContent = it ? "Soluzione e parametri chiave" : "Solution and key parameters";
  const hint = document.createElement("p");
  hint.className = "hint";
  if (hybrid) {
    hint.textContent = it
      ? `Hybrid Solar incluso: ${formatNumber(hybrid.units, language)} apparecchi · ${formatNumber(hybrid.installedPvKwp, language, 2)} kWp · ${formatNumber(hybrid.gridOffsetKwh, language)} kWh/anno di offset rete. Il beneficio Hybrid è già incluso nel risparmio netto.`
      : `Hybrid Solar included: ${formatNumber(hybrid.units, language)} luminaires · ${formatNumber(hybrid.installedPvKwp, language, 2)} kWp · ${formatNumber(hybrid.gridOffsetKwh, language)} kWh/year grid offset. Hybrid benefit is already included in net savings.`;
  } else {
    hint.textContent = it
      ? "La sintesi usa gli stessi parametri economici del Business Case attivo."
      : "The summary uses the same economic assumptions as the active Business Case.";
  }

  const values = document.createElement("div");
  values.className = "kpis customer-summary-kpis";
  values.appendChild(makeKpi(
    it ? "Indicizzazione prezzo energia" : "Energy-price escalation",
    `${formatNumber(energyEscalation, language, 1)}% ${it ? "annuo" : "p.a."}`,
    "energy-escalation",
  ));
  values.appendChild(makeKpi(
    it ? "Indicizzazione canone/OPEX" : "Service/OPEX escalation",
    `${formatNumber(opexEscalation, language, 1)}% ${it ? "annuo" : "p.a."}`,
    "opex-escalation",
  ));

  section.append(title, hint, values);
  summary.insertAdjacentElement("afterend", section);
}

export function renderReportExecutiveRefinement() {
  const live = getLiveBusinessCaseResult(window.location.search);
  if (!live?.project || !live?.result) return;
  const report = document.querySelector(".report-preview");
  if (!report) return;
  renderExecutiveRefinement(report, live.project, live.result);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderReportExecutiveRefinement();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener(LIVE_BUSINESS_CASE_EVENT, schedule);
  window.addEventListener("focus", schedule);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  schedule();
}
