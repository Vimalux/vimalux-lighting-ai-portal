import autoTable from "jspdf-autotable";
import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const money = (value, lang = "en") => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
}).format(safe(value));

const number = (value, digits = 0, lang = "en") => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(safe(value));

function card(doc, x, y, w, h, label, value, teal, navy, light) {
  doc.setFillColor(...light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.1);
  doc.text(label, x + 4, y + 6, { maxWidth: w - 8 });
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(value, x + 4, y + h - 5);
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.7);
  doc.line(x + 4, y + h - 2.5, x + w - 4, y + h - 2.5);
}

function horizontalBars(doc, x, y, w, labels, values, lang, teal, navy, muted) {
  const max = Math.max(1, ...values.map((value) => Math.max(0, safe(value))));
  labels.forEach((label, index) => {
    const yy = y + index * 19;
    const value = Math.max(0, safe(values[index]));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...navy);
    doc.text(label, x, yy + 4);
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x, yy + 7, w, 5, 1, 1, "F");
    doc.setFillColor(...teal);
    doc.roundedRect(x, yy + 7, w * value / max, 5, 1, 1, "F");
    doc.setFontSize(7.2);
    doc.setTextColor(...muted);
    doc.text(money(value, lang), x + w, yy + 4, { align: "right" });
  });
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
  const energyBefore = safe(calculated.baselineKwh) * safe(project.assumptions?.energyPrice);
  const energyAfter = safe(calculated.finalKwh) * safe(project.assumptions?.energyPrice);
  const maintenanceSaving = safe(calculated.maintenanceSaving);
  const annualFee = safe(calculated.customerAnnualPayment);
  const netBenefit = safe(calculated.customerAnnualNetBenefit);
  const cashRows = Array.isArray(calculated.cashFlowRows) ? calculated.cashFlowRows : [];

  doc.addPage();
  section(it ? "Dashboard economico ed energetico" : "Economic & Energy Dashboard", 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Vista sintetica generata dallo stesso motore di calcolo utilizzato nel dashboard VIMALUX Intelligence."
    : "Summary view generated by the same calculation engine used by the VIMALUX Intelligence dashboard.", 14, 28);

  const cardW = 42.5;
  card(doc, 14, 35, cardW, 27, it ? "Costo energia attuale" : "Current energy cost", money(energyBefore, lang), teal, navy, light);
  card(doc, 60.5, 35, cardW, 27, it ? "Costo energia futuro" : "Future energy cost", money(energyAfter, lang), teal, navy, light);
  card(doc, 107, 35, cardW, 27, it ? "Beneficio netto annuo" : "Annual net benefit", money(netBenefit, lang), teal, navy, light);
  card(doc, 153.5, 35, cardW, 27, "Payback", calculated.payback == null ? "–" : `${number(calculated.payback, 1, lang)} ${it ? "anni" : "yrs"}`, teal, navy, light);

  section(it ? "Costo energetico annuo" : "Annual Energy Cost", 76);
  horizontalBars(doc, 14, 83, 80,
    [it ? "Situazione attuale" : "Current", it ? "Dopo LED + Smart" : "After LED + Smart"],
    [energyBefore, energyAfter], lang, teal, navy, muted);

  section(it ? "Composizione del beneficio annuo" : "Annual Benefit Composition", 76);
  horizontalBars(doc, 108, 83, 88,
    [it ? "Risparmio energia" : "Energy saving", it ? "Risparmio manutenzione" : "Maintenance saving", it ? "Canone Smart / CMS" : "Smart / CMS fee"],
    [safe(calculated.energySaving), maintenanceSaving, annualFee], lang, teal, navy, muted);

  section(it ? "Indicatori ambientali e operativi" : "Environmental & Operational Indicators", 158);
  autoTable(doc, {
    startY: 164,
    theme: "grid",
    head: [[it ? "Indicatore" : "Indicator", it ? "Valore" : "Value", it ? "Interpretazione" : "Interpretation"]],
    body: [
      [it ? "Riduzione energia" : "Energy reduction", `${number(calculated.energyReductionPercent, 1, lang)}%`, it ? "Riduzione rispetto alla baseline" : "Reduction versus baseline"],
      [it ? "Energia risparmiata" : "Energy saved", `${number(Math.max(0, safe(calculated.baselineKwh) - safe(calculated.finalKwh)), 0, lang)} kWh/anno`, it ? "Effetto LED + Smart" : "LED + Smart effect"],
      [it ? "Riduzione CO₂" : "CO₂ reduction", `${number(safe(calculated.co2ReductionKg) / 1000, 1, lang)} t/anno`, it ? "Sulla base del fattore CO₂ impostato" : "Based on configured CO₂ factor"],
      [it ? "Punti luce aggiornati" : "Upgraded lighting points", number(calculated.upgradedQuantity, 0, lang), it ? "Copertura del progetto" : "Project coverage"],
      [it ? "Punti Smart connessi" : "Smart connected points", number(calculated.lcuQuantity, 0, lang), it ? "Monitoraggio e controllo remoto" : "Remote monitoring and control"],
    ],
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.7 },
    columnStyles: { 1: { halign: "right", cellWidth: 42 } },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "I grafici sono preliminari e seguono le ipotesi economiche del Business Case. La validazione illuminotecnica definitiva avviene in VIMALUX Planner."
    : "Charts are preliminary and follow the Business Case assumptions. Final lighting-design validation is completed in VIMALUX Planner.", 14, 262, { maxWidth: 182 });

  doc.addPage();
  section(it ? `Cash flow cliente – ${calculated.analysisPeriod} anni` : `Customer Cash Flow – ${calculated.analysisPeriod} years`, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Il grafico mostra il cash flow cumulativo del Comune sulla base dell'investimento, dei risparmi e dei pagamenti previsti dal modello selezionato."
    : "The chart shows cumulative municipality cash flow based on investment, savings and payments under the selected commercial model.", 14, 28, { maxWidth: 182 });

  lineChart(doc, 14, 36, 182, 83, cashRows, teal, navy, muted);

  section(it ? "Cash flow annuale" : "Annual Cash Flow", 130);
  autoTable(doc, {
    startY: 136,
    theme: "grid",
    head: [[
      it ? "Anno" : "Year",
      it ? "Beneficio lordo" : "Gross benefit",
      it ? "Servizi/OPEX" : "Service/OPEX",
      it ? "Finanz./canone" : "Finance/payment",
      it ? "Cash flow netto" : "Net cash flow",
      it ? "Cumulativo" : "Cumulative",
    ]],
    body: cashRows.map((row) => [
      row.year,
      money(row.grossBenefit, lang),
      money(row.serviceOpex, lang),
      money(row.payment, lang),
      money(row.netCashFlow, lang),
      money(row.cumulative, lang),
    ]),
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: cashRows.length > 15 ? 5.8 : 6.5, cellPadding: cashRows.length > 15 ? 0.8 : 1.1 },
    columnStyles: {
      0: { halign: "center", cellWidth: 13 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  return calculated;
}
