import autoTable from "jspdf-autotable";
import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";
import { alignedTable, reportMoney, reportNumber } from "./reportPresentation.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = reportMoney;
const number = reportNumber;

function metricCard(doc, x, y, w, h, label, value, teal, navy, light) {
  doc.setFillColor(...light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(label, x + 4, y + 6, { maxWidth: w - 8 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...navy);
  doc.text(value, x + 4, y + h - 5);
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.6);
  doc.line(x + 4, y + h - 2.5, x + w - 4, y + h - 2.5);
}

function lineChart(doc, x, y, w, h, rows, teal, navy, muted) {
  if (!rows.length) return;
  const opening = safe(rows[0]?.cumulative) - safe(rows[0]?.netCashFlow);
  const points = [{ year: 0, cumulative: opening }, ...rows]
    .map((row) => ({ year: safe(row.year), value: safe(row.cumulative) }));
  const values = points.map((point) => point.value);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max === min) max = min + 1;
  const left = x + 17;
  const bottom = y + h - 12;
  const top = y + 5;
  const chartW = w - 22;
  const chartH = bottom - top;
  const finalYear = Math.max(1, points.at(-1)?.year || 1);
  const toX = (year) => left + (year / finalYear) * chartW;
  const toY = (value) => bottom - ((value - min) / (max - min)) * chartH;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  for (let i = 0; i <= 4; i += 1) {
    const value = min + (max - min) * i / 4;
    const yy = toY(value);
    doc.line(left, yy, left + chartW, yy);
    doc.setFontSize(6.4);
    doc.setTextColor(...muted);
    doc.text(`${Math.round(value / 1000)}k`, left - 2, yy + 2, { align: "right" });
  }
  const zeroY = toY(0);
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.45);
  doc.line(left, zeroY, left + chartW, zeroY);

  doc.setDrawColor(...teal);
  doc.setLineWidth(1.1);
  points.forEach((point, index) => {
    if (!index) return;
    const previous = points[index - 1];
    doc.line(toX(previous.year), toY(previous.value), toX(point.year), toY(point.value));
  });
  doc.setFontSize(6.6);
  doc.setTextColor(...muted);
  [0, Math.round(finalYear / 4), Math.round(finalYear / 2), Math.round(finalYear * 3 / 4), finalYear].forEach((year) => {
    doc.text(String(year), toX(year), bottom + 5, { align: "center" });
  });
}

function scenarioCard(doc, x, y, w, h, title, subtitle, rows, accent, navy, muted, light) {
  doc.setFillColor(...light);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFillColor(...accent);
  doc.rect(x, y, w, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, x + 4, y + 6.5, { maxWidth: w - 8 });
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.text(subtitle, x + 4, y + 15, { maxWidth: w - 8 });

  let rowY = y + 24;
  rows.forEach((row, index) => {
    doc.setFont("helvetica", index === rows.length - 1 ? "bold" : "normal");
    doc.setFontSize(index === rows.length - 1 ? 7.8 : 6.8);
    doc.setTextColor(...(index === rows.length - 1 ? navy : muted));
    doc.text(row.label, x + 4, rowY, { maxWidth: w * 0.56 });
    doc.text(row.value, x + w - 4, rowY, { align: "right" });
    if (index < rows.length - 1) {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(x + 4, rowY + 3, x + w - 4, rowY + 3);
    }
    rowY += index === rows.length - 2 ? 12 : 10;
  });
}

function phaseKey(row) {
  return `${Boolean(row?.cmsActive)}|${Boolean(row?.powerAidActive)}|${safe(row?.investmentPayment) > 0}`;
}

function buildDisplayedPhases(calculated) {
  const rows = Array.isArray(calculated.customerValueRows) ? calculated.customerValueRows : [];
  if (!rows.length) return [];
  const phases = [];
  let start = 0;
  for (let index = 1; index <= rows.length; index += 1) {
    if (index === rows.length || phaseKey(rows[index]) !== phaseKey(rows[start])) {
      phases.push({ startYear: start + 1, endYear: index, row: rows[start] });
      start = index;
    }
  }
  return phases;
}

function phaseTitle(phase, lang) {
  const it = lang === "it";
  const range = `${phase.startYear}-${phase.endYear}`;
  if (phase.row?.cmsActive && phase.row?.powerAidActive) return `CMS + PowerAiD ${range}`;
  if (phase.row?.cmsActive) return `${it ? "Solo CMS" : "CMS only"} ${range}`;
  if (safe(phase.row?.investmentPayment) > 0) return `${it ? "Finanziamento" : "Financing"} ${range}`;
  return `${it ? "Post-servizi" : "Post-service"} ${range}`;
}

function phaseSubtitle(phase, lang) {
  const it = lang === "it";
  if (phase.row?.cmsActive && phase.row?.powerAidActive) return it ? "CMS, CLO, manutenzione e PowerAiD attivi" : "CMS, CLO, maintenance and PowerAiD active";
  if (phase.row?.cmsActive) return it ? "CMS, CLO e manutenzione attivi; PowerAiD terminato" : "CMS, CLO and maintenance active; PowerAiD ended";
  return it ? "Solo benefici LED non dipendenti dai servizi Smart" : "Only LED benefits independent of Smart services";
}

export function buildYearOneScenario(calculated, phase) {
  const firstValue = Array.isArray(calculated?.customerValueRows) ? calculated.customerValueRows[0] || {} : {};
  const firstCash = Array.isArray(calculated?.cashFlowRows) ? calculated.cashFlowRows[0] || {} : {};
  const currentCost = safe(firstValue.currentOperatingCost);
  const cmsActive = Boolean(phase?.row?.cmsActive);
  const powerAidActive = Boolean(phase?.row?.powerAidActive) && cmsActive;

  const ledSaving = safe(firstCash.ledEnergySavingEUR);
  const cloSaving = cmsActive ? safe(firstCash.cloSavingEUR) : 0;
  const maintenanceSaving = cmsActive ? safe(calculated?.maintenanceSaving) : 0;
  const powerAidSaving = powerAidActive ? safe(firstCash.powerAidGrossSavingEUR) : 0;
  const grossBenefit = ledSaving + cloSaving + maintenanceSaving + powerAidSaving;

  const fixedServiceOpex = cmsActive ? safe(calculated?.fixedAnnualOpex) : 0;
  const powerAidFee = powerAidActive ? safe(firstCash.powerAidCustomerFee) : 0;
  const servicePayment = calculated?.dealType === "noleggio_operativo" ? 0 : fixedServiceOpex + powerAidFee;
  const investmentPayment = safe(phase?.row?.investmentPayment);
  const futureOperatingCost = Math.max(0, currentCost - grossBenefit);
  const customerSaving = grossBenefit - servicePayment - investmentPayment;

  return {
    currentCost,
    futureOperatingCost,
    servicePayment,
    investmentPayment,
    customerSaving,
    grossBenefit,
    cmsActive,
    powerAidActive,
  };
}

function renderScenarioComparison(doc, calculated, x, y, w, lang, colors) {
  const it = lang === "it";
  const { teal, navy, muted, light } = colors;
  const rows = Array.isArray(calculated.customerValueRows) ? calculated.customerValueRows : [];
  const first = rows[0] || {};
  const currentCost = safe(first.currentOperatingCost);
  const phases = buildDisplayedPhases(calculated);
  const normalizedPhases = phases.map((phase) => ({ phase, display: buildYearOneScenario(calculated, phase) }));
  const cards = [
    {
      title: it ? "Situazione attuale" : "Current situation",
      subtitle: it ? "Costo annuo di riferimento - prezzi anno 1" : "Current annual reference cost - year-1 prices",
      rows: [{ label: it ? "Costo annuo" : "Annual cost", value: money(currentCost, lang) }],
      accent: [31, 119, 180],
    },
    ...normalizedPhases.map(({ phase, display }) => ({
      title: phaseTitle(phase, lang),
      subtitle: `${phaseSubtitle(phase, lang)}${it ? " - prezzi anno 1" : " - year-1 prices"}`,
      rows: [
        { label: it ? "Energia + manutenzione" : "Energy + maintenance", value: money(display.futureOperatingCost, lang) },
        { label: it ? "Servizi/OPEX" : "Service/OPEX", value: money(display.servicePayment, lang) },
        ...(display.investmentPayment > 0 ? [{ label: it ? "Invest./finanz." : "Invest./finance", value: money(display.investmentPayment, lang) }] : []),
        { label: it ? "Beneficio netto Comune" : "Municipality net benefit", value: money(display.customerSaving, lang) },
      ],
      accent: display.powerAidActive ? teal : display.cmsActive ? [14, 116, 144] : [22, 163, 74],
    })),
  ];

  const columns = cards.length <= 3 ? cards.length : 2;
  const gap = 5;
  const cardW = (w - gap * (columns - 1)) / columns;
  const hasPaymentRow = cards.some((card) => card.rows.length > 3);
  const cardH = cards.length <= 3 ? (hasPaymentRow ? 76 : 68) : (hasPaymentRow ? 65 : 57);
  const rowsCount = Math.ceil(cards.length / columns);
  cards.forEach((card, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    scenarioCard(doc, x + col * (cardW + gap), y + row * (cardH + gap), cardW, cardH, card.title, card.subtitle, card.rows, card.accent, navy, muted, light);
  });

  const cardsBottom = y + rowsCount * cardH + (rowsCount - 1) * gap;
  const firstDisplay = normalizedPhases[0]?.display;
  const lastDisplay = normalizedPhases.at(-1)?.display;
  const displayedFirstSaving = Math.round(safe(firstDisplay?.customerSaving));
  const displayedLastSaving = Math.round(safe(lastDisplay?.customerSaving));
  const phaseDifference = displayedLastSaving - displayedFirstSaving;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.roundedRect(x, cardsBottom + 7, w, 25, 2, 2, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(it
    ? `Variazione beneficio netto tra prima e ultima fase, a prezzi anno 1: ${money(phaseDifference, lang)}`
    : `Net-benefit change between first and final phase, at year-1 prices: ${money(phaseDifference, lang)}`,
    x + 5, cardsBottom + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Il confronto mantiene costante il livello prezzi dell'anno 1. L'indicizzazione effettiva anno per anno resta nel cash flow di pagina 4."
    : "The comparison holds the year-1 price level constant. Actual year-by-year escalation remains in the page-4 cash flow.",
    x + 5, cardsBottom + 21, { maxWidth: w - 10 });
  return cardsBottom + 32;
}

export function appendProposalVisualPages(doc, project, options = {}) {
  const lang = options.lang === "it" ? "it" : "en";
  const it = lang === "it";
  const teal = options.teal || [15, 118, 110];
  const navy = options.navy || [15, 23, 42];
  const muted = options.muted || [71, 85, 105];
  const light = options.light || [248, 250, 252];
  const section = (title, y) => {
    doc.setTextColor(...teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, y);
    doc.setTextColor(...navy);
  };

  const calculated = calculateBusinessCase(applyWarrantyPricing(project));
  const cashRows = Array.isArray(calculated.cashFlowRows) ? calculated.cashFlowRows : [];
  const openingCash = cashRows.length ? safe(cashRows[0].cumulative) - safe(cashRows[0].netCashFlow) : 0;
  const initialOutlay = Math.max(0, -openingCash);
  const cashTableRows = [{ year: 0, grossBenefit: 0, serviceOpex: 0, payment: initialOutlay, netCashFlow: -initialOutlay, cumulative: openingCash }, ...cashRows];

  doc.addPage();
  section(it ? `Confronto economico - ${calculated.analysisPeriod} anni` : `Economic comparison - ${calculated.analysisPeriod} years`, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Confronto diretto delle fasi operative a prezzi costanti dell'anno 1. Il cash flow di pagina 4 mostra invece gli importi nominali indicizzati anno per anno."
    : "Direct comparison of operating phases at constant year-1 prices. Page 4 cash flow instead shows nominal year-by-year escalated amounts.", 14, 28, { maxWidth: 182 });

  const comparisonBottom = renderScenarioComparison(doc, calculated, 14, 38, 182, lang, { teal, navy, muted, light });
  const indicatorsY = Math.max(154, comparisonBottom + 12);
  section(it ? "Indicatori chiave" : "Key Indicators", indicatorsY);
  const cardW = 42.5;
  const metricsY = indicatorsY + 7;
  metricCard(doc, 14, metricsY, cardW, 25, it ? "Riduzione energia (anno 1)" : "Energy reduction (year 1)", `${number(calculated.energyReductionPercent, 1, lang)}%`, teal, navy, light);
  metricCard(doc, 60.5, metricsY, cardW, 25, it ? "Energia risparmiata (anno 1)" : "Energy saved (year 1)", `${number(Math.max(0, safe(calculated.baselineKwh) - safe(calculated.finalKwh)), 0, lang)} kWh`, teal, navy, light);
  metricCard(doc, 107, metricsY, cardW, 25, it ? "Riduzione CO2 (anno 1)" : "CO2 reduction (year 1)", `${number(safe(calculated.co2ReductionKg) / 1000, 1, lang)} t/${it ? "anno" : "yr"}`, teal, navy, light);
  metricCard(doc, 153.5, metricsY, cardW, 25, it ? "Punti Smart" : "Smart points", number(calculated.lcuQuantity, 0, lang), teal, navy, light);

  autoTable(doc, {
    startY: metricsY + 35,
    theme: "grid",
    head: [[it ? "Indicatore economico" : "Economic indicator", it ? "Valore" : "Value"]],
    body: [
      [it ? "Beneficio netto annuo Comune (anno 1)" : "Municipality annual net benefit (year 1)", money(calculated.customerAnnualNetBenefit, lang)],
      ["Payback", calculated.payback == null ? "-" : `${number(calculated.payback, 1, lang)} ${it ? "anni" : "yrs"}`],
      [it ? "Investimento iniziale" : "Initial investment", money(calculated.totalCapex, lang)],
    ],
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.4 },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right", cellWidth: 50 } },
    didParseCell: alignedTable({ 0: "left", 1: "right" }).didParseCell,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Visualizzazione preliminare basata sullo stesso motore di calcolo del dashboard Intelligence. La validazione illuminotecnica definitiva avviene in VIMALUX Planner."
    : "Preliminary visualization based on the same calculation engine as the Intelligence dashboard. Final lighting-design validation is completed in VIMALUX Planner.", 14, Math.min(270, doc.lastAutoTable.finalY + 12), { maxWidth: 182 });

  doc.addPage();
  section(it ? `Cash flow cliente - ${calculated.analysisPeriod} anni` : `Customer Cash Flow - ${calculated.analysisPeriod} years`, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Il grafico mostra il cash flow cumulativo del Comune includendo l'esborso iniziale, i risparmi e i pagamenti previsti dal modello selezionato."
    : "The chart shows cumulative municipality cash flow including initial outlay, savings and payments under the selected commercial model.", 14, 28, { maxWidth: 182 });

  lineChart(doc, 14, 36, 182, 83, cashRows, teal, navy, muted);

  section(it ? "Cash flow annuale" : "Annual Cash Flow", 130);
  autoTable(doc, {
    startY: 136,
    theme: "grid",
    head: [[it ? "Anno" : "Year", it ? "Beneficio lordo" : "Gross benefit", it ? "Servizi/OPEX" : "Service/OPEX", it ? "Invest./finanz." : "Invest./finance", it ? "Cash flow netto" : "Net cash flow", it ? "Cumulativo" : "Cumulative"]],
    body: cashTableRows.map((row) => [row.year, money(row.grossBenefit, lang), money(row.serviceOpex, lang), money(row.payment, lang), money(row.netCashFlow, lang), money(row.cumulative, lang)]),
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: cashTableRows.length > 15 ? 5.6 : 6.4, cellPadding: cashTableRows.length > 15 ? 0.72 : 1.0 },
    columnStyles: { 0: { halign: "center", cellWidth: 13 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: alignedTable({ 0: "center", 1: "right", 2: "right", 3: "right", 4: "right", 5: "right" }).didParseCell,
    margin: { left: 14, right: 14, bottom: 18 },
  });

  return calculated;
}