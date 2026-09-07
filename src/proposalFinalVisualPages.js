import autoTable from "jspdf-autotable";
import { calculateBusinessCase } from "./calculations.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";
import { applyWarrantyPricing } from "./warranty.js";
import { repairCostEvolutionProposalPage } from "./proposalCostEvolutionPage.js";
import { transformProposalCustomerText } from "./proposalCustomerVatText.js";
import { alignedTable, reportMoney, reportNumber } from "./reportPresentation.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function lineChart(doc, x, y, w, h, rows, colors) {
  if (!rows.length) return;
  const { teal, navy, muted } = colors;
  const opening = safe(rows[0]?.cumulative) - safe(rows[0]?.netCashFlow);
  const points = [{ year: 0, value: opening }, ...rows.map((row) => ({ year: safe(row.year), value: safe(row.cumulative) }))];
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
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...muted);
    doc.text(`${Math.round(value / 1000)}k`, left - 2, yy + 2, { align: "right" });
  }

  doc.setDrawColor(...navy);
  doc.setLineWidth(0.45);
  doc.line(left, toY(0), left + chartW, toY(0));
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

function summaryCard(doc, x, y, w, label, value, colors) {
  const { teal, navy, muted, light } = colors;
  doc.setFillColor(...light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, 25, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(label, x + 4, y + 6, { maxWidth: w - 8 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...navy);
  doc.text(value, x + 4, y + 19);
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.5);
  doc.line(x + 4, y + 22.5, x + w - 4, y + 22.5);
}

function appendCashFlowPage(doc, project, calculated, options = {}) {
  const lang = options.lang === "it" ? "it" : "en";
  const it = lang === "it";
  const customerText = (value) => transformProposalCustomerText(value, project, lang);
  const colors = {
    teal: options.teal || [15, 118, 110],
    navy: options.navy || [15, 23, 42],
    muted: options.muted || [71, 85, 105],
    light: options.light || [248, 250, 252],
  };
  const { teal, navy, muted, light } = colors;
  const cashRows = Array.isArray(calculated.cashFlowRows) ? calculated.cashFlowRows : [];
  const openingCash = cashRows.length ? safe(cashRows[0].cumulative) - safe(cashRows[0].netCashFlow) : 0;
  const initialOutlay = Math.max(0, -openingCash);
  const cashTableRows = [
    { year: 0, grossBenefit: 0, serviceOpex: 0, payment: initialOutlay, netCashFlow: -initialOutlay, cumulative: openingCash },
    ...cashRows,
  ];
  const isCashDeal = String(calculated.dealType || "").toLowerCase() === "cash";

  doc.addPage();
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(it ? `Cash flow cliente - ${calculated.analysisPeriod} anni` : `Customer Cash Flow - ${calculated.analysisPeriod} years`, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);

  let tableStartY;
  if (isCashDeal) {
    doc.text(customerText(it
      ? "Scenario acquisto diretto: il CAPEX iniziale è sostenuto dal Comune. La tabella mostra il recupero dell'investimento e il beneficio cumulativo anno per anno."
      : "Direct-purchase scenario: the municipality funds the initial CAPEX. The table shows investment recovery and cumulative benefit year by year."),
    14, 28, { maxWidth: 182 });

    const breakEven = calculated.payback == null
      ? "-"
      : `${reportNumber(calculated.payback, 1, lang)} ${it ? "anni" : "years"}`;
    summaryCard(doc, 14, 38, 55, it ? "Investimento iniziale" : "Initial investment", reportMoney(calculated.totalCapex, lang), colors);
    summaryCard(doc, 77.5, 38, 55, it ? "Beneficio netto anno 1" : "Year-1 net benefit", reportMoney(calculated.customerAnnualNetBenefit, lang), colors);
    summaryCard(doc, 141, 38, 55, it ? "Break-even" : "Break-even", breakEven, colors);
    tableStartY = 76;
  } else {
    doc.text(customerText(it
      ? "Il grafico mostra il cash flow cumulativo del Comune includendo risparmi, servizi e pagamenti previsti dal modello finanziato selezionato."
      : "The chart shows cumulative municipality cash flow including savings, services and payments under the selected financed model."),
    14, 28, { maxWidth: 182 });
    lineChart(doc, 14, 36, 182, 83, cashRows, colors);
    tableStartY = 136;
  }

  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(it ? "Cash flow annuale" : "Annual Cash Flow", 14, tableStartY - 6);

  autoTable(doc, {
    startY: tableStartY,
    theme: "grid",
    head: [[
      it ? "Anno" : "Year",
      it ? "Beneficio lordo" : "Gross benefit",
      it ? "Servizi/OPEX" : "Service/OPEX",
      it ? "Invest./finanz." : "Invest./finance",
      it ? "Cash flow netto" : "Net cash flow",
      it ? "Cumulativo" : "Cumulative",
    ]],
    body: cashTableRows.map((row) => [
      row.year,
      reportMoney(row.grossBenefit, lang),
      reportMoney(row.serviceOpex, lang),
      reportMoney(row.payment, lang),
      reportMoney(row.netCashFlow, lang),
      reportMoney(row.cumulative, lang),
    ]),
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: {
      font: "helvetica",
      fontSize: cashTableRows.length > 15 ? (isCashDeal ? 6.0 : 5.6) : 6.4,
      cellPadding: cashTableRows.length > 15 ? (isCashDeal ? 0.82 : 0.72) : 1.0,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 13 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    didParseCell: alignedTable({ 0: "center", 1: "right", 2: "right", 3: "right", 4: "right", 5: "right" }).didParseCell,
    margin: { left: 14, right: 14, bottom: 18 },
  });
}

export function appendFinalProposalVisualPages(doc, project, options = {}) {
  const calculated = calculateBusinessCase(applyWarrantyPricing(project));

  // Add a blank page first, then draw the reconciled year-1 cost/savings page on it.
  // This avoids writing the legacy escalated chart/text into the PDF content stream.
  doc.addPage();
  const costPage = doc.getNumberOfPages();
  repairCostEvolutionProposalPage(doc, project, calculated, costPage, options);

  appendCashFlowPage(doc, project, calculated, options);
  return calculated;
}
