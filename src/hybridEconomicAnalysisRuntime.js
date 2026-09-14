import { calculateBusinessCase } from "./calculations.js";
import { getLiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT } from "./liveBusinessCaseResult.js";
import { getHybridSolarAutoStatus, HYBRID_SOLAR_AUTO_STATUS_EVENT } from "./hybridSolarAutoStatus.js";

const PROJECTS_KEY = "vimalux-intelligence-projects";
const MARKER = "data-vimalux-hybrid-economic-ui";

function safe(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function resolveActiveProject(projects = [], search = "") {
  const params = new URLSearchParams(search || "");
  const businessCaseId = params.get("business_case_id");
  const opportunityId = params.get("opportunity_id");
  if (businessCaseId || opportunityId) {
    return projects.find((project) =>
      project?.id === businessCaseId ||
      project?.crm?.businessCaseRecordId === businessCaseId ||
      project?.project?.businessCaseId === businessCaseId ||
      project?.crm?.opportunityId === opportunityId ||
      project?.crm?.uniqueProjectId === opportunityId
    ) || null;
  }
  return projects[0] || null;
}

export function hybridEconomicDisplayFromResult(project, result) {
  if (!project || !result) return null;
  const hybrid = result.hybridSolar || {};
  if (!hybrid.enabled) return null;
  const rows = Array.isArray(hybrid.rows) ? hybrid.rows : [];
  const installedPvKwp = rows.reduce(
    (sum, row) => sum + Math.max(0, safe(row?.quantity)) * Math.max(0, safe(row?.pvWp)) / 1000,
    0,
  );
  const eligibleGridKwh = Math.max(0, safe(result.hybridEligibleGridKwh));
  const savingKwh = Math.max(0, safe(result.hybridSolarSavingKwh));
  const coveragePercent = eligibleGridKwh > 0
    ? savingKwh / eligibleGridKwh * 100
    : Math.max(0, safe(hybrid.totalContributionPercent));
  return {
    language: project.language || "it",
    currency: project.project?.currency || "EUR",
    units: Math.max(0, safe(hybrid.totalHybridUnits)),
    installedPvKwp,
    annualPvKwh: Math.max(0, safe(hybrid.totalPvKwh)),
    usableSolarKwh: Math.max(0, safe(hybrid.totalUsableSolarKwh)),
    savingKwh,
    savingEur: Math.max(0, safe(result.hybridSolarSavingEUR)),
    coveragePercent,
    finalKwh: Math.max(0, safe(result.finalKwh)),
    location: hybrid.location?.municipality || hybrid.location?.name || hybrid.location?.label || "",
  };
}

export function hybridEconomicDisplay(project) {
  if (!project) return null;
  return hybridEconomicDisplayFromResult(project, calculateBusinessCase(project));
}

function text(value) {
  return String(value || "").trim().toLowerCase();
}

function findCard(titleFragments) {
  return [...document.querySelectorAll("section.card")].find((card) => {
    const heading = text(card.querySelector("h2")?.textContent);
    return titleFragments.some((fragment) => heading.includes(fragment));
  });
}

function formatNumber(value, language, digits = 0) {
  const locale = language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";
  return new Intl.NumberFormat(locale, {
    useGrouping: "always",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

function formatMoney(value, language, currency) {
  const locale = language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "EUR",
    useGrouping: "always",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function makeBreakdownRow(label, value) {
  const row = document.createElement("div");
  row.setAttribute(MARKER, "row");
  const name = document.createElement("span");
  const spacer = document.createElement("span");
  const strong = document.createElement("strong");
  name.textContent = label;
  strong.textContent = value;
  row.append(name, spacer, strong);
  return row;
}

function insertBeforeFinal(card, row) {
  const breakdown = card?.querySelector(".breakdown");
  if (!breakdown) return;
  const children = [...breakdown.children];
  const finalRow = children.find((child) => {
    const label = text(child.querySelector("span")?.textContent);
    return label.includes("consumo finale") || label.includes("final consumption");
  });
  breakdown.insertBefore(row, finalRow || null);
}

function insertBeforeTotalBenefit(card, row) {
  const breakdown = card?.querySelector(".breakdown");
  if (!breakdown) return;
  const children = [...breakdown.children];
  const totalRow = children.find((child) => {
    const label = text(child.querySelector("span")?.textContent);
    return label.includes("beneficio totale") || label.includes("total annual benefit");
  });
  breakdown.insertBefore(row, totalRow || null);
}

function makeHybridCard(display) {
  const it = display.language === "it";
  const card = document.createElement("section");
  card.className = "card customer-summary-card hybrid-economic-summary";
  card.setAttribute(MARKER, "card");
  const title = document.createElement("h2");
  title.textContent = it ? "Hybrid Solar · contributo incluso nel Business Case" : "Hybrid Solar · contribution included in Business Case";
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = display.savingKwh > 0
    ? (it
      ? `Il beneficio solare riduce esclusivamente il prelievo degli apparecchi Hybrid ed è già incluso nel risparmio netto.${display.location ? ` Profilo solare: ${display.location}.` : ""} Il dettaglio mensile è riportato nel PDF.`
      : `Solar benefit only offsets Hybrid-luminaire grid consumption and is already included in the net saving.${display.location ? ` Solar profile: ${display.location}.` : ""} Monthly detail is included in the PDF.`)
    : (it
      ? "Apparecchi Hybrid rilevati. Il beneficio resta a zero finché non è disponibile una resa solare dal Comune o inserita manualmente."
      : "Hybrid luminaires detected. Benefit remains zero until a municipality solar yield or manual yield is available.");

  const autoStatus = getHybridSolarAutoStatus();
  const status = document.createElement("p");
  status.className = "hint";
  if (autoStatus?.state) {
    const labels = it
      ? { resolving: "Calcolo automatico", ready: "Calcolo automatico completato", blocked: "Calcolo automatico bloccato", error: "Errore calcolo automatico" }
      : { resolving: "Automatic calculation", ready: "Automatic calculation completed", blocked: "Automatic calculation blocked", error: "Automatic calculation error" };
    status.textContent = `${labels[autoStatus.state] || "Hybrid auto"}: ${autoStatus.message || "—"}`;
    if (autoStatus.state === "error" || autoStatus.state === "blocked") status.style.color = "#b42318";
  } else if (display.savingKwh <= 0) {
    status.textContent = it ? "Stato calcolo automatico: in attesa di avvio." : "Automatic calculation status: waiting to start.";
  }

  const kpis = document.createElement("div");
  kpis.className = "kpis customer-summary-kpis";
  const items = [
    [it ? "Unità Hybrid" : "Hybrid units", formatNumber(display.units, display.language)],
    [it ? "PV installato" : "Installed PV", `${formatNumber(display.installedPvKwp, display.language, 2)} kWp`],
    [it ? "Produzione PV annua" : "Annual PV production", `${formatNumber(display.annualPvKwh, display.language)} kWh`],
    [it ? "Offset rete incluso BC" : "Grid offset included in BC", `${formatNumber(display.savingKwh, display.language)} kWh`],
    [it ? "Beneficio Hybrid annuo" : "Annual Hybrid benefit", formatMoney(display.savingEur, display.language, display.currency)],
    [it ? "Copertura solare carico Hybrid" : "Solar coverage of Hybrid load", `${formatNumber(display.coveragePercent, display.language, 1)}%`],
  ];
  for (const [label, value] of items) {
    const item = document.createElement("div");
    item.className = "kpi";
    const span = document.createElement("span");
    const strong = document.createElement("strong");
    span.textContent = label;
    strong.textContent = value;
    item.append(span, strong);
    kpis.appendChild(item);
  }
  card.append(title, hint);
  if (status.textContent) card.append(status);
  card.append(kpis);
  return card;
}

function fallbackDisplay() {
  let projects;
  try {
    projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    return null;
  }
  const project = resolveActiveProject(projects, window.location.search);
  return hybridEconomicDisplay(project);
}

export function renderHybridEconomicAnalysis() {
  document.querySelectorAll(`[${MARKER}]`).forEach((node) => node.remove());

  const live = getLiveBusinessCaseResult(window.location.search);
  const display = live
    ? hybridEconomicDisplayFromResult(live.project, live.result)
    : fallbackDisplay();
  if (!display) return;

  const waterfall = findCard(["cascata dei risparmi", "savings waterfall"]);
  const benefits = findCard(["benefici annuali", "annual benefits"]);
  if (!waterfall || !benefits) return;

  const it = display.language === "it";
  insertBeforeFinal(waterfall, makeBreakdownRow(
    it ? "Risparmio Hybrid Solar" : "Hybrid Solar saving",
    `${formatNumber(display.savingKwh, display.language)} kWh`,
  ));
  insertBeforeTotalBenefit(benefits, makeBreakdownRow(
    it ? "Beneficio Hybrid Solar annuo" : "Annual Hybrid Solar benefit",
    formatMoney(display.savingEur, display.language, display.currency),
  ));

  const twoCol = waterfall.parentElement;
  if (twoCol?.classList.contains("two-col")) {
    twoCol.insertAdjacentElement("beforebegin", makeHybridCard(display));
  }
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    renderHybridEconomicAnalysis();
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener(LIVE_BUSINESS_CASE_EVENT, scheduleRender);
  window.addEventListener(HYBRID_SOLAR_AUTO_STATUS_EVENT, scheduleRender);
  window.addEventListener("focus", scheduleRender);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(); });
  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  scheduleRender();
}
