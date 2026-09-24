import { getActiveBusinessCaseResult, LIVE_BUSINESS_CASE_EVENT } from "./liveBusinessCaseResult.js";
import { internalProfitabilityMetrics } from "./profitabilityMetrics.js";
import { partnerReportOptions, partnerTotals } from "./partners.js";

const INTERNAL_ID = "vimalux-internal-profitability-runtime";
const PARTNER_ID = "vimalux-partner-profitability-runtime";
const STYLE_ID = "vimalux-profitability-runtime-style";
let scheduled = false;

const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function localeFor(language) {
  return language === "it" ? "it-IT" : language === "da" ? "da-DK" : "en-GB";
}

function money(value, language = "it", currency = "EUR") {
  return new Intl.NumberFormat(localeFor(language), { style: "currency", currency, maximumFractionDigits: 0 }).format(numberValue(value));
}

function percent(value, language = "it") {
  return `${new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(numberValue(value))}%`;
}

function labels(language) {
  if (language === "da") return {
    title: "VIMALUX projektrentabilitet",
    subtitle: "Intern økonomi opdelt i CAPEX/hardware, tilbagevendende OPEX, Adaptive Dimming og samlet projektbidrag.",
    hardware: "CAPEX / hardware",
    recurring: "Tilbagevendende OPEX",
    cms: "DATEK CMS",
    gateway: "Gateway / connectivity",
    otherOpex: "Øvrig OPEX",
    adaptive: "Adaptive Dimming / Felicity",
    project: "Samlet VIMALUX projektbidrag",
    customerSales: "Kundesalg",
    supplierCost: "Leverandør-/direkte omkostning",
    margin: "VIMALUX margin",
    marginPct: "Margin %",
    annual: "Pr. år",
    contract: "Kontraktperiode",
    revenue: "Kontraktomsætning",
    directCosts: "Alle direkte projektomkostninger",
    contribution: "VIMALUX projektbidrag efter direkte omkostninger",
    minimum: "Minimum samlet projektmargin",
    buffer: "Marginbuffer mod minimum",
    note: "Projektbidraget er efter alle direkte projektomkostninger, men før VIMALUX' generelle selskabsoverhead og skat.",
    partnerTitle: "Partnerøkonomi · portefølje",
    partner: "Partner / rolle",
    customerAnnual: "Kundesalg / år",
    supplierAnnual: "Leverandørkost / år",
    vimaluxAnnual: "VIMALUX margin / år",
    customerContract: "Kundeværdi kontrakt",
    supplierContract: "Leverandørkost kontrakt",
    contractMargin: "VIMALUX kontraktmargin",
  };
  if (language === "en") return {
    title: "VIMALUX project profitability",
    subtitle: "Internal economics split into CAPEX/hardware, recurring OPEX, Adaptive Dimming and total project contribution.",
    hardware: "CAPEX / hardware",
    recurring: "Recurring OPEX",
    cms: "DATEK CMS",
    gateway: "Gateway / connectivity",
    otherOpex: "Other OPEX",
    adaptive: "Adaptive Dimming / Felicity",
    project: "Total VIMALUX project contribution",
    customerSales: "Customer sales",
    supplierCost: "Supplier/direct cost",
    margin: "VIMALUX margin",
    marginPct: "Margin %",
    annual: "Per year",
    contract: "Contract period",
    revenue: "Contract revenue",
    directCosts: "All direct project costs",
    contribution: "VIMALUX project contribution after direct costs",
    minimum: "Minimum total project margin",
    buffer: "Margin buffer vs minimum",
    note: "Project contribution is after all direct project costs, but before VIMALUX corporate overhead and tax.",
    partnerTitle: "Partner economics · portfolio",
    partner: "Partner / role",
    customerAnnual: "Customer sales / year",
    supplierAnnual: "Supplier cost / year",
    vimaluxAnnual: "VIMALUX margin / year",
    customerContract: "Customer contract value",
    supplierContract: "Supplier contract cost",
    contractMargin: "VIMALUX contract margin",
  };
  return {
    title: "Redditività progetto VIMALUX",
    subtitle: "Economia interna separata tra CAPEX/hardware, OPEX ricorrente, Adaptive Dimming e contributo complessivo del progetto.",
    hardware: "CAPEX / hardware",
    recurring: "OPEX ricorrente",
    cms: "DATEK CMS",
    gateway: "Gateway / connectivity",
    otherOpex: "Altri OPEX",
    adaptive: "Adaptive Dimming / Felicity",
    project: "Contributo complessivo progetto VIMALUX",
    customerSales: "Vendita cliente",
    supplierCost: "Costo fornitore/diretto",
    margin: "Margine VIMALUX",
    marginPct: "Margine %",
    annual: "Annuale",
    contract: "Periodo contrattuale",
    revenue: "Ricavi contratto",
    directCosts: "Tutti i costi diretti di progetto",
    contribution: "Contributo VIMALUX dopo tutti i costi diretti",
    minimum: "Margine minimo complessivo progetto",
    buffer: "Buffer margine rispetto al minimo",
    note: "Il contributo progetto è calcolato dopo tutti i costi diretti del progetto, ma prima dell'overhead generale VIMALUX e delle imposte societarie.",
    partnerTitle: "Economia partner · portafoglio",
    partner: "Partner / ruolo",
    customerAnnual: "Vendita cliente / anno",
    supplierAnnual: "Costo fornitore / anno",
    vimaluxAnnual: "Margine VIMALUX / anno",
    customerContract: "Valore cliente contratto",
    supplierContract: "Costo fornitore contratto",
    contractMargin: "Margine VIMALUX contratto",
  };
}

function activeViewText() {
  return String(document.querySelector("aside button.active")?.textContent || "").trim().toLowerCase();
}

function isInternalReportView() {
  const text = activeViewText();
  return text.includes("rapporto interno") || text.includes("internal report") || text.includes("intern rapport");
}

function isPartnerReportsView() {
  const text = activeViewText();
  return text.includes("partner report");
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .vimalux-profitability-runtime{margin:0 0 18px 0}
    .vimalux-profitability-runtime h2{margin:0 0 6px 0}
    .vimalux-profitability-runtime .profit-note{margin:4px 0 16px;color:#64748b;font-size:13px}
    .vimalux-profitability-runtime .profit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin:12px 0}
    .vimalux-profitability-runtime .profit-box{border:1px solid #dbe5ee;border-radius:10px;padding:12px;background:#fff}
    .vimalux-profitability-runtime .profit-box h3{margin:0 0 10px;color:#0f766e;font-size:15px}
    .vimalux-profitability-runtime .profit-row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:6px 0;border-bottom:1px solid #eef2f7;font-size:13px}
    .vimalux-profitability-runtime .profit-row:last-child{border-bottom:0}
    .vimalux-profitability-runtime .profit-row strong.positive{color:#047857}
    .vimalux-profitability-runtime .profit-row strong.negative{color:#b91c1c}
    .vimalux-profitability-runtime .profit-project{border:2px solid #0f766e;background:#f0fdfa}
    .vimalux-profitability-runtime .profit-table-wrap{overflow:auto}
    .vimalux-profitability-runtime table{width:100%;border-collapse:collapse;font-size:12px}
    .vimalux-profitability-runtime th,.vimalux-profitability-runtime td{padding:8px 9px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap}
    .vimalux-profitability-runtime th:first-child,.vimalux-profitability-runtime td:first-child{text-align:left}
    .vimalux-profitability-runtime th{background:#f8fafc;color:#475569}
  `;
  document.head.appendChild(style);
}

function box(title, rows, projectBox = false) {
  return `<section class="profit-box${projectBox ? " profit-project" : ""}"><h3>${escapeHtml(title)}</h3>${rows.map(([label, value, cls]) => `<div class="profit-row"><span>${escapeHtml(label)}</span><strong class="${cls || ""}">${value}</strong></div>`).join("")}</section>`;
}

function relabelExistingInternalReport(language) {
  const replacements = language === "it"
    ? [["Margine minimo GO (%)", "Margine minimo complessivo progetto (%)"], ["Utile netto progetto", "Contributo netto VIMALUX progetto"]]
    : language === "da"
      ? [["Minimum GO margin (%)", "Minimum samlet projektmargin (%)"], ["Net project profit", "VIMALUX projektbidrag"]]
      : [["Minimum GO margin (%)", "Minimum total project margin (%)"], ["Net project profit", "VIMALUX project contribution"]];
  const root = document.querySelector("main");
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const original = String(node.nodeValue || "").trim();
    const match = replacements.find(([from]) => original === from);
    if (match) node.nodeValue = String(node.nodeValue).replace(match[0], match[1]);
  }
}

function renderInternal() {
  const oldPartner = document.getElementById(PARTNER_ID);
  if (oldPartner) oldPartner.remove();
  if (!isInternalReportView()) {
    document.getElementById(INTERNAL_ID)?.remove();
    return;
  }
  const entry = getActiveBusinessCaseResult(window.location.search) || getActiveBusinessCaseResult("");
  if (!entry?.project || !entry?.result) return;
  ensureStyle();
  const { project, result } = entry;
  const language = project.language || "it";
  const currency = project.project?.currency || "EUR";
  const t = labels(language);
  const m = internalProfitabilityMetrics(project, result);
  const signature = JSON.stringify([project.id, result.totalContractRevenue, result.totalDirectCosts, result.cmsRevenue, result.cmsDirectCost, result.powerAidCustomerFee, result.powerAidSupplierCost, result.totalCapex, result.capexDirectCost, result.minimumMarginPercent, language]);
  let host = document.getElementById(INTERNAL_ID);
  if (!host) {
    host = document.createElement("section");
    host.id = INTERNAL_ID;
    host.className = "card vimalux-profitability-runtime";
    const main = document.querySelector("main");
    const header = main?.querySelector("header");
    if (main && header) header.insertAdjacentElement("afterend", host);
  }
  if (!host || host.dataset.signature === signature) {
    relabelExistingInternalReport(language);
    return;
  }
  host.dataset.signature = signature;
  const positiveClass = (value) => numberValue(value) >= 0 ? "positive" : "negative";
  host.innerHTML = `
    <h2>${escapeHtml(t.title)}</h2><p class="profit-note">${escapeHtml(t.subtitle)}</p>
    <div class="profit-grid">
      ${box(t.hardware, [
        [t.customerSales, money(m.hardware.revenue, language, currency)],
        [t.supplierCost, money(m.hardware.directCost, language, currency)],
        [t.margin, money(m.hardware.margin, language, currency), positiveClass(m.hardware.margin)],
        [t.marginPct, percent(m.hardware.marginPercent, language), positiveClass(m.hardware.margin)],
      ])}
      ${box(t.recurring, [
        [t.customerSales + " · " + t.annual, money(m.recurringOpex.revenueAnnual, language, currency)],
        [t.supplierCost + " · " + t.annual, money(m.recurringOpex.costAnnual, language, currency)],
        [t.margin + " · " + t.annual, money(m.recurringOpex.marginAnnual, language, currency), positiveClass(m.recurringOpex.marginAnnual)],
        [t.marginPct, percent(m.recurringOpex.marginPercent, language), positiveClass(m.recurringOpex.marginAnnual)],
        [t.margin + " · " + t.contract, money(m.recurringOpex.contractMargin, language, currency), positiveClass(m.recurringOpex.contractMargin)],
      ])}
      ${box(t.cms, [
        [t.customerSales + " · " + t.annual, money(m.cms.revenueAnnual, language, currency)],
        [t.supplierCost + " · " + t.annual, money(m.cms.costAnnual, language, currency)],
        [t.margin + " · " + t.annual, money(m.cms.marginAnnual, language, currency), positiveClass(m.cms.marginAnnual)],
        [t.marginPct, percent(m.cms.marginPercent, language), positiveClass(m.cms.marginAnnual)],
        [t.margin + " · " + t.contract, money(m.cms.contractMargin, language, currency), positiveClass(m.cms.contractMargin)],
      ])}
      ${box(t.gateway, [
        [t.customerSales + " · " + t.annual, money(m.gateway.revenueAnnual, language, currency)],
        [t.supplierCost + " · " + t.annual, money(m.gateway.costAnnual, language, currency)],
        [t.margin + " · " + t.annual, money(m.gateway.marginAnnual, language, currency), positiveClass(m.gateway.marginAnnual)],
        [t.marginPct, percent(m.gateway.marginPercent, language), positiveClass(m.gateway.marginAnnual)],
      ])}
      ${box(t.otherOpex, [
        [t.customerSales + " · " + t.annual, money(m.otherOpex.revenueAnnual, language, currency)],
        [t.supplierCost + " · " + t.annual, money(m.otherOpex.costAnnual, language, currency)],
        [t.margin + " · " + t.annual, money(m.otherOpex.marginAnnual, language, currency), positiveClass(m.otherOpex.marginAnnual)],
        [t.marginPct, percent(m.otherOpex.marginPercent, language), positiveClass(m.otherOpex.marginAnnual)],
      ])}
      ${box(t.adaptive, [
        [t.customerSales + " · " + t.annual, money(m.adaptive.revenueAnnual, language, currency)],
        [t.supplierCost + " · " + t.annual, money(m.adaptive.costAnnual, language, currency)],
        [t.margin + " · " + t.annual, money(m.adaptive.marginAnnual, language, currency), positiveClass(m.adaptive.marginAnnual)],
        [t.marginPct, percent(m.adaptive.marginPercent, language), positiveClass(m.adaptive.marginAnnual)],
        [t.margin + " · " + t.contract, money(m.adaptive.contractMargin, language, currency), positiveClass(m.adaptive.contractMargin)],
      ])}
      ${box(t.project, [
        [t.revenue, money(m.project.revenue, language, currency)],
        [t.directCosts, money(m.project.directCosts, language, currency)],
        [t.contribution, money(m.project.contribution, language, currency), positiveClass(m.project.contribution)],
        [t.marginPct, percent(m.project.marginPercent, language), positiveClass(m.project.marginBufferPercent)],
        [t.minimum, percent(m.project.minimumMarginPercent, language)],
        [t.buffer, percent(m.project.marginBufferPercent, language), positiveClass(m.project.marginBufferPercent)],
      ], true)}
    </div>
    <p class="profit-note">${escapeHtml(t.note)}</p>`;
  relabelExistingInternalReport(language);
}

function storedProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

function renderPartnerPortfolio() {
  const oldInternal = document.getElementById(INTERNAL_ID);
  if (oldInternal && !isInternalReportView()) oldInternal.remove();
  if (!isPartnerReportsView()) {
    document.getElementById(PARTNER_ID)?.remove();
    return;
  }
  const projects = storedProjects();
  if (!projects.length) return;
  ensureStyle();
  const active = getActiveBusinessCaseResult(window.location.search) || getActiveBusinessCaseResult("");
  const language = active?.project?.language || projects[0]?.language || "it";
  const currency = active?.project?.project?.currency || projects[0]?.project?.currency || "EUR";
  const t = labels(language);
  const options = partnerReportOptions(projects);
  const rows = options.map((option) => ({ option, totals: partnerTotals(projects, option.partner, option.role) }));
  const signature = JSON.stringify(rows.map(({ option, totals }) => [option.key, totals.projects, totals.annualCustomerRevenue, totals.annualSupplierCost, totals.customerContractValue, totals.supplierContractCost]));
  let host = document.getElementById(PARTNER_ID);
  if (!host) {
    host = document.createElement("section");
    host.id = PARTNER_ID;
    host.className = "card vimalux-profitability-runtime";
    const main = document.querySelector("main");
    const header = main?.querySelector("header");
    if (main && header) header.insertAdjacentElement("afterend", host);
  }
  if (!host || host.dataset.signature === signature) return;
  host.dataset.signature = signature;
  host.innerHTML = `<h2>${escapeHtml(t.partnerTitle)}</h2><p class="profit-note">${escapeHtml(t.subtitle)}</p><div class="profit-table-wrap"><table><thead><tr><th>${escapeHtml(t.partner)}</th><th>${escapeHtml(t.customerAnnual)}</th><th>${escapeHtml(t.supplierAnnual)}</th><th>${escapeHtml(t.vimaluxAnnual)}</th><th>${escapeHtml(t.marginPct)}</th><th>${escapeHtml(t.customerContract)}</th><th>${escapeHtml(t.supplierContract)}</th><th>${escapeHtml(t.contractMargin)}</th></tr></thead><tbody>${rows.map(({ option, totals }) => `<tr><td>${escapeHtml(option.label)}</td><td>${money(totals.annualCustomerRevenue, language, currency)}</td><td>${money(totals.annualSupplierCost, language, currency)}</td><td>${money(totals.annualVimaluxMargin, language, currency)}</td><td>${percent(totals.annualMarginPercent, language)}</td><td>${money(totals.customerContractValue, language, currency)}</td><td>${money(totals.supplierContractCost, language, currency)}</td><td>${money(totals.contractMargin, language, currency)}</td></tr>`).join("")}</tbody></table></div>`;
}

function render() {
  scheduled = false;
  renderInternal();
  renderPartnerPortfolio();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(render);
}

if (typeof window !== "undefined") {
  window.addEventListener(LIVE_BUSINESS_CASE_EVENT, schedule);
  window.addEventListener("popstate", schedule);
  window.addEventListener("storage", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
}
