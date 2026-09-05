import { calculateBusinessCase } from "./calculations.js";

const PROJECTS_KEY = "vimalux-intelligence-projects";
const MARKER = "data-vimalux-hybrid-economic-ui";

export function resolveActiveProject(projects = [], search = "") {
  const params = new URLSearchParams(search || "");
  const businessCaseId = params.get("business_case_id");
  const opportunityId = params.get("opportunity_id");
  if (businessCaseId || opportunityId) {
    const matched = projects.find((project) =>
      project?.id === businessCaseId ||
      project?.crm?.businessCaseRecordId === businessCaseId ||
      project?.project?.businessCaseId === businessCaseId ||
      project?.crm?.opportunityId === opportunityId ||
      project?.crm?.uniqueProjectId === opportunityId
    );
    if (matched) return matched;
  }
  return projects[0] || null;
}

export function hybridEconomicDisplay(project) {
  if (!project) return null;
  const result = calculateBusinessCase(project);
  const hybrid = result.hybridSolar || {};
  if (!hybrid.enabled) return null;
  return {
    language: project.language || "it",
    currency: project.project?.currency || "EUR",
    units: Number(hybrid.totalHybridUnits || 0),
    pvKwh: Number(hybrid.totalPvKwh || 0),
    usableSolarKwh: Number(hybrid.totalUsableSolarKwh || 0),
    savingKwh: Number(result.hybridSolarSavingKwh || 0),
    savingEur: Number(result.hybridSolarSavingEUR || 0),
    contributionPercent: Number(hybrid.totalContributionPercent || 0),
    finalKwh: Number(result.finalKwh || 0),
  };
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
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(value || 0));
}

function formatMoney(value, language, currency) {
  const locale = language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency || "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));
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
  card.className = "card";
  card.setAttribute(MARKER, "card");
  const title = document.createElement("h2");
  title.textContent = it ? "Hybrid Solar · beneficio incluso nel Business Case" : "Hybrid Solar · benefit included in Business Case";
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = display.savingKwh > 0
    ? (it ? "Il contributo solare è applicato dopo LED, CLO e PowerAiD e riduce esclusivamente il consumo degli apparecchi ibridi." : "Solar contribution is applied after LED, CLO and PowerAiD and only offsets the load of hybrid luminaires.")
    : (it ? "Apparecchi ibridi rilevati. Il beneficio resta a zero finché non è disponibile una resa solare dal Comune o inserita manualmente." : "Hybrid luminaires detected. Benefit remains zero until a municipality solar yield or manual yield is available.");
  const kpis = document.createElement("div");
  kpis.className = "kpis";
  const items = [
    [it ? "Unità ibride" : "Hybrid units", formatNumber(display.units, display.language)],
    [it ? "Solare utilizzabile" : "Usable solar", `${formatNumber(display.usableSolarKwh, display.language)} kWh`],
    [it ? "Offset rete incluso BC" : "Grid offset included in BC", `${formatNumber(display.savingKwh, display.language)} kWh`],
    [it ? "Beneficio Hybrid annuo" : "Annual Hybrid Benefit", formatMoney(display.savingEur, display.language, display.currency)],
    [it ? "Contributo solare" : "Solar contribution", `${formatNumber(display.contributionPercent, display.language, 1)}%`],
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
  card.append(title, hint, kpis);
  return card;
}

export function renderHybridEconomicAnalysis() {
  document.querySelectorAll(`[${MARKER}]`).forEach((node) => node.remove());
  let projects;
  try {
    projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    return;
  }
  const project = resolveActiveProject(projects, window.location.search);
  const display = hybridEconomicDisplay(project);
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
    twoCol.insertAdjacentElement("afterend", makeHybridCard(display));
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
  window.addEventListener("focus", scheduleRender);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(); });
  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  scheduleRender();
}
