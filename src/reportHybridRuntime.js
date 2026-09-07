import { getLiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT } from "./liveBusinessCaseResult.js";
import { buildYearOneCustomerValuePhases, customerValueSegments } from "./customerValuePhases.js";

const MARKER = "data-vimalux-report-hybrid";

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

export function hybridReportDashboardModel(project, result) {
  const hybrid = result?.hybridSolar || {};
  if (!project || !hybrid.enabled) return null;
  const installedPvKwp = (Array.isArray(hybrid.rows) ? hybrid.rows : []).reduce(
    (sum, row) => sum + Math.max(0, safe(row?.quantity)) * Math.max(0, safe(row?.pvWp)) / 1000,
    0,
  );
  const eligibleGridKwh = Math.max(0, safe(result?.hybridEligibleGridKwh));
  const actualContributionPercent = eligibleGridKwh > 0
    ? Math.max(0, safe(result?.hybridSolarSavingKwh)) / eligibleGridKwh * 100
    : Math.max(0, safe(hybrid?.totalContributionPercent));
  return {
    language: project.language || "it",
    currency: project.project?.currency || "EUR",
    units: Math.max(0, safe(hybrid.totalHybridUnits)),
    installedPvKwp,
    annualPvKwh: Math.max(0, safe(hybrid.totalPvKwh)),
    gridOffsetKwh: Math.max(0, safe(result.hybridSolarSavingKwh)),
    benefitEur: Math.max(0, safe(result.hybridSolarSavingEUR)),
    contributionPercent: actualContributionPercent,
    location: hybrid.location?.municipality || hybrid.location?.name || hybrid.location?.label || "",
    source: hybrid.location?.source || "PVGIS",
  };
}

function makeKpi(label, value) {
  const item = document.createElement("div");
  item.className = "kpi";
  const span = document.createElement("span");
  const strong = document.createElement("strong");
  span.textContent = label;
  strong.textContent = value;
  item.append(span, strong);
  return item;
}

function renderHybridSummary(report, project, result) {
  const model = hybridReportDashboardModel(project, result);
  if (!model) return;
  const it = model.language === "it";
  const anchor = report.querySelector(".customer-summary-card");
  if (!anchor) return;

  const section = document.createElement("section");
  section.className = "card customer-summary-card hybrid-report-summary";
  section.setAttribute(MARKER, "summary");
  const title = document.createElement("h2");
  title.textContent = it ? "Hybrid Solar · contributo incluso nel Business Case" : "Hybrid Solar · contribution included in Business Case";
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = it
    ? `Il beneficio solare riduce esclusivamente il prelievo degli apparecchi Hybrid ed è già incluso nel risparmio netto. ${model.location ? `Profilo solare: ${model.location}. ` : ""}Il dettaglio mensile è riportato nel PDF.`
    : `Solar benefit only offsets Hybrid-luminaire grid consumption and is already included in the net saving. ${model.location ? `Solar profile: ${model.location}. ` : ""}The monthly detail is included in the PDF.`;
  const kpis = document.createElement("div");
  kpis.className = "kpis customer-summary-kpis";
  const items = [
    [it ? "Unità Hybrid" : "Hybrid units", formatNumber(model.units, model.language)],
    [it ? "PV installato" : "Installed PV", `${formatNumber(model.installedPvKwp, model.language, 2)} kWp`],
    [it ? "Produzione PV annua" : "Annual PV production", `${formatNumber(model.annualPvKwh, model.language)} kWh`],
    [it ? "Offset rete incluso BC" : "Grid offset included in BC", `${formatNumber(model.gridOffsetKwh, model.language)} kWh`],
    [it ? "Beneficio Hybrid annuo" : "Annual Hybrid benefit", formatMoney(model.benefitEur, model.language, model.currency)],
    [it ? "Copertura solare carico Hybrid" : "Solar coverage of Hybrid load", `${formatNumber(model.contributionPercent, model.language, 1)}%`],
  ];
  items.forEach(([label, value]) => kpis.appendChild(makeKpi(label, value)));
  section.append(title, hint, kpis);
  anchor.insertAdjacentElement("afterend", section);
}

function setSegment(bar, className, part, label, money) {
  let segment = bar.querySelector(`.${className}`);
  if (part.value <= 0) {
    segment?.remove();
    return;
  }
  if (!segment) {
    segment = document.createElement("span");
    segment.className = className;
    bar.appendChild(segment);
  }
  segment.style.height = `${Math.max(0, part.pct)}%`;
  segment.title = `${label}: ${money(part.value)}`;
  segment.replaceChildren();
  if (part.pct >= 11) {
    const b = document.createElement("b");
    b.textContent = `${Math.round(part.pct)}%`;
    const small = document.createElement("small");
    small.textContent = money(part.value);
    segment.append(b, small);
  }
}

function repairCustomerValueChart(report, project, result) {
  const chart = report.querySelector(".customer-value-chart");
  if (!chart) return;
  const { phases, first } = buildYearOneCustomerValuePhases(result);
  if (!first || !phases.length) return;
  const phaseNodes = [...chart.querySelectorAll(".value-period-phase")];
  if (phaseNodes.length !== phases.length) return;

  const language = project.language || "it";
  const currency = project.project?.currency || "EUR";
  const money = (value) => formatMoney(value, language, currency);
  const it = language === "it";
  const labels = {
    futureOperatingCost: it ? "Energia + manutenzione" : "Energy + maintenance",
    servicePayment: "OPEX",
    investmentPayment: it ? "Investimento" : "Investment",
    customerSaving: it ? "Risparmio cliente" : "Customer saving",
  };
  const classes = {
    futureOperatingCost: "value-future",
    servicePayment: "value-service",
    investmentPayment: "value-payment",
    customerSaving: "value-saving",
  };

  phases.forEach((phase, index) => {
    const node = phaseNodes[index];
    const bar = node.querySelector(".value-summary-bar");
    if (!bar) return;
    const parts = Object.fromEntries(customerValueSegments(phase.display).map((part) => [part.key, part]));
    Object.keys(classes).forEach((key) => setSegment(bar, classes[key], parts[key] || { value: 0, pct: 0 }, labels[key], money));
    const saving = node.querySelector(":scope > b");
    if (saving) saving.textContent = `${money(phase.display.customerSaving)} / ${it ? "anno" : "year"}`;
  });

  let note = chart.querySelector(`[${MARKER}="chart-note"]`);
  if (!note && safe(result.hybridSolarSavingEUR) > 0) {
    note = document.createElement("div");
    note.className = "smart-full-period-note";
    note.setAttribute(MARKER, "chart-note");
    chart.appendChild(note);
  }
  if (note) {
    note.textContent = it
      ? `Hybrid Solar incluso nella curva: ${money(result.hybridSolarSavingEUR)} / anno · ${formatNumber(result.hybridSolarSavingKwh, language)} kWh/anno.`
      : `Hybrid Solar included in the chart: ${money(result.hybridSolarSavingEUR)} / year · ${formatNumber(result.hybridSolarSavingKwh, language)} kWh/year.`;
  }
}

export function renderHybridReportDashboard() {
  document.querySelectorAll(`[${MARKER}="summary"]`).forEach((node) => node.remove());
  const live = getLiveBusinessCaseResult(window.location.search);
  if (!live?.project || !live?.result) return;
  const report = document.querySelector(".report-preview");
  if (!report) return;
  renderHybridSummary(report, live.project, live.result);
  repairCustomerValueChart(report, live.project, live.result);
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderHybridReportDashboard();
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
