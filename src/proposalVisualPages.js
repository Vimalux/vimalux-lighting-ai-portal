import autoTable from "jspdf-autotable";
import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const groupedInteger = (value, separator) => String(Math.round(Math.abs(safe(value))))
  .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

const money = (value, lang = "en") => {
  const numeric = safe(value);
  const sign = numeric < 0 ? "-" : "";
  const grouped = groupedInteger(numeric, lang === "it" ? "." : ",");
  return lang === "it" ? `${sign}${grouped} €` : `${sign}€${grouped}`;
};

const number = (value, digits = 0, lang = "en") => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
}).format(safe(value));

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

function phaseFromRow(row, startYear, endYear, active, label, sublabel) {
  return {
    startYear,
    endYear,
    active,
    label,
    sublabel,
    currentOperatingCost: safe(row?.currentOperatingCost),
    futureOperatingCost: safe(row?.futureOperatingCost),
    servicePayment: safe(row?.servicePayment),
    investmentPayment: safe(row?.investmentPayment),
    customerSaving: Math.max(0, safe(row?.customerSaving)),
  };
}

function costEvolutionChart(doc, calculated, project, x, y, w, h, lang, colors) {
  const it = lang === "it";
  const { teal, navy, muted } = colors;
  const rows = Array.isArray(calculated.customerValueRows) ? calculated.customerValueRows : [];
  const first = rows[0] || {};
  const analysisPeriod = Math.max(1, Math.round(safe(calculated.analysisPeriod)));
  const serviceYears = Math.max(0, Math.min(analysisPeriod, Math.round(safe(calculated.serviceAgreementPeriod))));
  const financeYears = Math.max(0, Math.min(analysisPeriod, Math.round(safe(calculated.financingYears))));
  const currentCost = safe(first.currentOperatingCost);

  const phases = [];
  if (serviceYears > 0) {
    phases.push(phaseFromRow(
      rows[0] || first,
      1,
      serviceYears,
      true,
      `${it ? "Anni" : "Years"} 1–${serviceYears}`,
      calculated.dealType === "cash"
        ? (it ? "Smart senza finanziamento" : "Smart without financing")
        : calculated.dealType === "finance"
          ? (it ? `Finanziamento ${financeYears} anni` : `${financeYears}-year financing`)
          : (it ? "Pagamento all-inclusive" : "All-inclusive payment"),
    ));
  }
  if (serviceYears < analysisPeriod) {
    const postRow = rows[Math.min(serviceYears, Math.max(0, rows.length - 1))] || rows.at(-1) || first;
    phases.push(phaseFromRow(
      postRow,
      Math.max(1, serviceYears + 1),
      analysisPeriod,
      false,
      `${it ? "Anni" : "Years"} ${Math.max(1, serviceYears + 1)}–${analysisPeriod}`,
      it ? "Dopo il contratto Smart" : "After Smart contract",
    ));
  }
  if (!phases.length) {
    phases.push(phaseFromRow(
      first,
      1,
      analysisPeriod,
      false,
      `${it ? "Anni" : "Years"} 1–${analysisPeriod}`,
      it ? "Scenario post-upgrade" : "Post-upgrade scenario",
    ));
  }

  const baselineY = y + 12;
  const chartBottom = y + h - 31;
  const chartHeight = chartBottom - baselineY;
  const currentW = 34;
  const gap = 7;
  const timelineX = x + currentW + gap;
  const timelineW = w - currentW - gap;
  const maxStack = Math.max(1, currentCost, ...phases.map((phase) => phase.futureOperatingCost + phase.servicePayment + phase.investmentPayment + phase.customerSaving));
  const heightFor = (value) => chartHeight * Math.max(0, value) / maxStack;

  doc.setDrawColor(100, 116, 139);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.35);
  doc.line(timelineX, baselineY, x + w, baselineY);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...navy);
  doc.text(`100% · ${money(currentCost, lang)} / ${it ? "anno" : "year"}`, x + w, baselineY - 3, { align: "right" });

  const currentH = heightFor(currentCost);
  doc.setFillColor(31, 119, 180);
  doc.rect(x, chartBottom - currentH, currentW, currentH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.4);
  doc.text("100%", x + currentW / 2, chartBottom - currentH / 2 - 1, { align: "center" });
  doc.setFontSize(6.1);
  doc.text(money(currentCost, lang), x + currentW / 2, chartBottom - currentH / 2 + 4, { align: "center" });
  doc.setTextColor(...navy);
  doc.setFontSize(8);
  doc.text(it ? "Situazione attuale" : "Current situation", x + currentW / 2, chartBottom + 6, { align: "center" });

  const colorsByKey = {
    futureOperatingCost: [77, 182, 172],
    servicePayment: [245, 158, 11],
    investmentPayment: [148, 163, 184],
    customerSaving: [22, 163, 74],
  };
  const labelsByKey = {
    futureOperatingCost: it ? "Costo operativo post-upgrade" : "Post-upgrade operating cost",
    servicePayment: it ? "OPEX servizi" : "Service OPEX",
    investmentPayment: it ? "Pagamento contratto / investimento" : "Contract / investment payment",
    customerSaving: it ? "Risparmio netto cliente" : "Customer net saving",
  };
  const keys = ["futureOperatingCost", "servicePayment", "investmentPayment", "customerSaving"];

  let phaseX = timelineX;
  phases.forEach((phase, phaseIndex) => {
    const duration = Math.max(1, phase.endYear - phase.startYear + 1);
    const phaseW = timelineW * duration / analysisPeriod;
    let cursor = chartBottom;
    keys.forEach((key) => {
      const value = safe(phase[key]);
      if (value <= 0) return;
      const segmentH = heightFor(value);
      cursor -= segmentH;
      doc.setFillColor(...colorsByKey[key]);
      doc.rect(phaseX, cursor, phaseW, segmentH, "F");
      if (segmentH >= 8 && phaseW >= 36) {
        const pct = currentCost ? value / currentCost * 100 : 0;
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.4);
        doc.text(`${number(pct, 0, lang)}%`, phaseX + phaseW / 2, cursor + segmentH / 2 - 0.5, { align: "center" });
        if (segmentH >= 13) {
          doc.setFontSize(5.6);
          doc.text(money(value, lang), phaseX + phaseW / 2, cursor + segmentH / 2 + 4, { align: "center" });
        }
      }
    });

    if (phaseIndex > 0) {
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.45);
      doc.line(phaseX, baselineY, phaseX, chartBottom);
    }

    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(phase.label, phaseX + phaseW / 2, chartBottom + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.1);
    doc.setTextColor(...muted);
    doc.text(phase.sublabel, phaseX + phaseW / 2, chartBottom + 11, { align: "center", maxWidth: Math.max(28, phaseW - 4) });
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.7);
    doc.text(`${money(phase.customerSaving, lang)} / ${it ? "anno" : "year"}`, phaseX + phaseW / 2, chartBottom + 16, { align: "center" });
    phaseX += phaseW;
  });

  const legendY = chartBottom + 24;
  let legendX = x;
  keys.forEach((key) => {
    doc.setFillColor(...colorsByKey[key]);
    doc.roundedRect(legendX, legendY - 3, 3, 3, 0.5, 0.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.7);
    doc.setTextColor(...muted);
    doc.text(labelsByKey[key], legendX + 4.5, legendY);
    legendX += Math.min(48, 8 + labelsByKey[key].length * 1.15);
  });

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.roundedRect(x, legendY + 5, w, serviceYears < analysisPeriod ? 18 : 11, 2, 2, "FD");
  doc.setTextColor(4, 120, 87);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  if (serviceYears >= analysisPeriod) {
    doc.text(it ? `Smart attivo per l'intero periodo di analisi - ${analysisPeriod} anni` : `Smart active for the full analysis period - ${analysisPeriod} years`, x + w / 2, legendY + 12, { align: "center" });
  } else {
    const smartPhase = phases.find((phase) => phase.active) || phases[0];
    const postPhase = phases.find((phase) => !phase.active && phase.startYear > serviceYears) || phases.at(-1);
    const incremental = Math.max(0, safe(smartPhase?.customerSaving) - safe(postPhase?.customerSaving));
    doc.text(it ? `Smart attivo anni 1–${serviceYears}; scenario post-contratto anni ${serviceYears + 1}–${analysisPeriod}` : `Smart active years 1–${serviceYears}; post-contract scenario years ${serviceYears + 1}–${analysisPeriod}`, x + w / 2, legendY + 11, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.text(it ? `Differenza annua tra le due fasi: ${money(incremental, lang)}. Il rinnovo Smart sarà valutato alla scadenza del contratto.` : `Annual difference between the two phases: ${money(incremental, lang)}. Smart renewal will be assessed at contract expiry.`, x + w / 2, legendY + 16, { align: "center", maxWidth: w - 8 });
  }
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
  const cashTableRows = [
    {
      year: 0,
      grossBenefit: 0,
      serviceOpex: 0,
      payment: initialOutlay,
      netCashFlow: -initialOutlay,
      cumulative: openingCash,
    },
    ...cashRows,
  ];

  doc.addPage();
  section(it ? `Evoluzione dei costi e dei risparmi - ${calculated.analysisPeriod} anni` : `Cost & Savings Evolution - ${calculated.analysisPeriod} years`, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "La larghezza di ogni fase corrisponde alla sua durata. La linea superiore rappresenta il costo annuo attuale."
    : "Each phase width represents its duration. The upper line represents the current annual cost.", 14, 28, { maxWidth: 182 });

  costEvolutionChart(doc, calculated, project, 14, 34, 182, 126, lang, { teal, navy, muted });

  section(it ? "Indicatori chiave" : "Key Indicators", 181);
  const cardW = 42.5;
  metricCard(doc, 14, 188, cardW, 25, it ? "Riduzione energia" : "Energy reduction", `${number(calculated.energyReductionPercent, 1, lang)}%`, teal, navy, light);
  metricCard(doc, 60.5, 188, cardW, 25, it ? "Energia risparmiata" : "Energy saved", `${number(Math.max(0, safe(calculated.baselineKwh) - safe(calculated.finalKwh)), 0, lang)} kWh`, teal, navy, light);
  metricCard(doc, 107, 188, cardW, 25, it ? "Riduzione CO2" : "CO2 reduction", `${number(safe(calculated.co2ReductionKg) / 1000, 1, lang)} t/${it ? "anno" : "yr"}`, teal, navy, light);
  metricCard(doc, 153.5, 188, cardW, 25, it ? "Punti Smart" : "Smart points", number(calculated.lcuQuantity, 0, lang), teal, navy, light);

  autoTable(doc, {
    startY: 222,
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
    columnStyles: { 1: { halign: "right", cellWidth: 50 } },
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Visualizzazione preliminare basata sullo stesso motore di calcolo del dashboard Intelligence. La validazione illuminotecnica definitiva avviene in VIMALUX Planner."
    : "Preliminary visualization based on the same calculation engine as the Intelligence dashboard. Final lighting-design validation is completed in VIMALUX Planner.", 14, 263, { maxWidth: 182 });

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
      money(row.grossBenefit, lang),
      money(row.serviceOpex, lang),
      money(row.payment, lang),
      money(row.netCashFlow, lang),
      money(row.cumulative, lang),
    ]),
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: cashTableRows.length > 15 ? 5.6 : 6.4, cellPadding: cashTableRows.length > 15 ? 0.72 : 1.0 },
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
