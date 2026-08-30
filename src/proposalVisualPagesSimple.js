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
  doc.text(title, x + 4, y + 6.5);
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

function renderScenarioComparison(doc, calculated, x, y, w, lang, colors) {
  const it = lang === "it";
  const { teal, navy, muted, light } = colors;
  const rows = Array.isArray(calculated.customerValueRows) ? calculated.customerValueRows : [];
  const first = rows[0] || {};
  const analysisPeriod = Math.max(1, Math.round(safe(calculated.analysisPeriod)));
  const serviceYears = Math.max(0, Math.min(analysisPeriod, Math.round(safe(calculated.serviceAgreementPeriod))));
  const post = rows[serviceYears] || rows.at(-1) || first;
  const currentCost = safe(first.currentOperatingCost);
  const smartSaving = safe(first.customerSaving);
  const postSaving = safe(post.customerSaving);
  const phaseDifference = postSaving - smartSaving;
  const cardGap = 5;
  const cardW = (w - cardGap * 2) / 3;
  const cardH = 68;

  scenarioCard(doc, x, y, cardW, cardH,
    it ? "Situazione attuale" : "Current situation",
    it ? "Costo annuo di riferimento" : "Current annual reference cost",
    [
      { label: it ? "Costo annuo" : "Annual cost", value: money(currentCost, lang) },
    ], [31, 119, 180], navy, muted, light);

  scenarioCard(doc, x + cardW + cardGap, y, cardW, cardH,
    `${it ? "Scenario Smart" : "Smart scenario"} 1-${serviceYears}`,
    it ? "Durante il contratto Smart" : "During the Smart contract",
    [
      { label: it ? "Costo operativo" : "Operating cost", value: money(first.futureOperatingCost, lang) },
      { label: it ? "Canone Smart/CMS" : "Smart/CMS fee", value: money(first.servicePayment, lang) },
      { label: it ? "Beneficio netto Comune" : "Municipality net benefit", value: money(smartSaving, lang) },
    ], teal, navy, muted, light);

  scenarioCard(doc, x + (cardW + cardGap) * 2, y, cardW, cardH,
    `${it ? "Post-contratto" : "Post-contract"} ${serviceYears + 1}-${analysisPeriod}`,
    it ? "Scenario dopo la scadenza Smart" : "Scenario after Smart contract expiry",
    [
      { label: it ? "Costo operativo" : "Operating cost", value: money(post.futureOperatingCost, lang) },
      { label: it ? "Canone Smart/CMS" : "Smart/CMS fee", value: money(post.servicePayment, lang) },
      { label: it ? "Beneficio netto Comune" : "Municipality net benefit", value: money(postSaving, lang) },
    ], [22, 163, 74], navy, muted, light);

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.roundedRect(x, y + cardH + 7, w, 22, 2, 2, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(it
    ? `Differenza annua post-contratto vs periodo Smart: ${money(phaseDifference, lang)}`
    : `Annual post-contract difference vs Smart period: ${money(phaseDifference, lang)}`,
    x + 5, y + cardH + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...muted);
  doc.text(it
    ? "I valori sono importi annui calcolati direttamente dallo stesso Business Case del dashboard."
    : "Values are annual amounts calculated directly from the same Business Case used by the dashboard.",
    x + 5, y + cardH + 20, { maxWidth: w - 10 });
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
    ? "Confronto diretto dei tre scenari. Gli importi in euro sono il riferimento principale; le percentuali energetiche sono riportate separatamente negli indicatori."
    : "Direct comparison of the three scenarios. Euro amounts are the primary reference; energy percentages are shown separately in the indicators.", 14, 28, { maxWidth: 182 });

  renderScenarioComparison(doc, calculated, 14, 38, 182, lang, { teal, navy, muted, light });

  section(it ? "Indicatori chiave" : "Key Indicators", 151);
  const cardW = 42.5;
  metricCard(doc, 14, 158, cardW, 25, it ? "Riduzione energia" : "Energy reduction", `${number(calculated.energyReductionPercent, 1, lang)}%`, teal, navy, light);
  metricCard(doc, 60.5, 158, cardW, 25, it ? "Energia risparmiata" : "Energy saved", `${number(Math.max(0, safe(calculated.baselineKwh) - safe(calculated.finalKwh)), 0, lang)} kWh`, teal, navy, light);
  metricCard(doc, 107, 158, cardW, 25, it ? "Riduzione CO2" : "CO2 reduction", `${number(safe(calculated.co2ReductionKg) / 1000, 1, lang)} t/${it ? "anno" : "yr"}`, teal, navy, light);
  metricCard(doc, 153.5, 158, cardW, 25, it ? "Punti Smart" : "Smart points", number(calculated.lcuQuantity, 0, lang), teal, navy, light);

  autoTable(doc, {
    startY: 193,
    theme: "grid",
    head: [[it ? "Indicatore economico" : "Economic indicator", it ? "Valore" : "Value"]],
    body: [
      [it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit", money(calculated.customerAnnualNetBenefit, lang)],
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
    : "Preliminary visualization based on the same calculation engine as the Intelligence dashboard. Final lighting-design validation is completed in VIMALUX Planner.", 14, 239, { maxWidth: 182 });

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
