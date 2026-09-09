import autoTable from "jspdf-autotable";
import { buildYearOneCustomerValuePhases } from "./customerValuePhases.js";
import { summarizeExistingDimming } from "./existingDimming.js";
import { transformProposalCustomerText } from "./proposalCustomerVatText.js";
import { alignedTable, pdfSafeText, reportMoney, reportNumber } from "./reportPresentation.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function metricCard(doc, x, y, w, h, label, value, colors) {
  const { teal, navy, light, muted } = colors;
  doc.setFillColor(...light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...muted);
  doc.text(label, x + 3, y + 5.5, { maxWidth: w - 6 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.setTextColor(...navy);
  doc.text(value, x + 3, y + h - 4.5, { maxWidth: w - 6 });
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.5);
  doc.line(x + 3, y + h - 2.2, x + w - 3, y + h - 2.2);
}

function phaseLabel(phase, calculated, lang) {
  const it = lang === "it";
  const display = phase.display || {};
  const financing = safe(display.investmentPayment) > 0;
  if (financing) {
    return calculated.dealType === "noleggio_operativo"
      ? (it ? "Pagamento all-inclusive" : "All-inclusive payment")
      : (it ? "Finanziamento + Smart" : "Financing + Smart");
  }
  if (display.cmsActive && display.powerAidActive) return "CMS + PowerAiD";
  if (display.cmsActive) return it ? "Solo CMS" : "CMS only";
  return it ? "Dopo il contratto Smart" : "After Smart contract";
}

function dimmingSummaryValue(project, calculated, lang) {
  const it = lang === "it";
  const summary = summarizeExistingDimming(project);
  if (!summary.active) return it ? "Nessuna riduzione configurata" : "No reduction configured";
  const representative = summary.profiles[0];
  const weighted = safe(calculated.nominalSystemKwh) > 0
    ? safe(calculated.existingDimmingSavingKwh) / safe(calculated.nominalSystemKwh) * 100
    : safe(representative?.annualReductionPct);
  if (representative?.method === "profile" && representative?.nightly) {
    const reduction = reportNumber(representative.reductionDuringReducedPct, 0, lang);
    const full = reportNumber(representative.fullPowerHoursPerNight, 1, lang);
    const reduced = reportNumber(representative.reducedHoursPerNight, 1, lang);
    const average = reportNumber(weighted, 1, lang);
    const timing = representative.note ? ` · ${representative.note}` : "";
    return it
      ? `${reduction}% nella fascia ridotta${timing} · ${full} h + ${reduced} h/notte · media annua ${average}%`
      : `${reduction}% during reduced period${timing} · ${full} h + ${reduced} h/night · annual average ${average}%`;
  }
  return it
    ? `Riduzione media annua ${reportNumber(weighted, 1, lang)}%`
    : `Annual average reduction ${reportNumber(weighted, 1, lang)}%`;
}

function drawCostChart(doc, calculated, x, y, w, h, lang, colors) {
  const it = lang === "it";
  const { navy, muted } = colors;
  const { phases, first, analysisPeriod } = buildYearOneCustomerValuePhases(calculated);
  if (!first || !phases.length) return;
  const currentCost = Math.max(1, safe(first.currentOperatingCost));
  const baselineY = y + 12;
  const chartBottom = y + h - 31;
  const chartHeight = chartBottom - baselineY;
  const currentW = 34;
  const gap = 7;
  const timelineX = x + currentW + gap;
  const timelineW = w - currentW - gap;
  const heightFor = (value) => chartHeight * Math.max(0, safe(value)) / currentCost;
  const money = (value) => reportMoney(value, lang);

  doc.setDrawColor(100, 116, 139);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.35);
  doc.line(timelineX, baselineY, x + w, baselineY);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...navy);
  doc.text(pdfSafeText(`100% | ${money(currentCost)} / ${it ? "anno" : "year"}`), x + w, baselineY - 3, { align: "right" });

  doc.setFillColor(31, 119, 180);
  doc.rect(x, chartBottom - chartHeight, currentW, chartHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.4);
  doc.text("100%", x + currentW / 2, chartBottom - chartHeight / 2 - 1, { align: "center" });
  doc.setFontSize(6.1);
  doc.text(money(currentCost), x + currentW / 2, chartBottom - chartHeight / 2 + 4, { align: "center" });
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
    const duration = Math.max(1, phase.end - phase.start + 1);
    const phaseW = timelineW * duration / Math.max(1, analysisPeriod);
    const display = phase.display || {};
    let cursor = chartBottom;
    keys.forEach((key) => {
      const value = Math.max(0, safe(display[key]));
      if (!value) return;
      const segmentH = heightFor(value);
      cursor -= segmentH;
      doc.setFillColor(...colorsByKey[key]);
      doc.rect(phaseX, cursor, phaseW, segmentH, "F");
      if (segmentH >= 8 && phaseW >= 32) {
        const pct = value / currentCost * 100;
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.text(`${reportNumber(pct, 0, lang)}%`, phaseX + phaseW / 2, cursor + segmentH / 2 - 0.5, { align: "center" });
        if (segmentH >= 13) {
          doc.setFontSize(5.5);
          doc.text(money(value), phaseX + phaseW / 2, cursor + segmentH / 2 + 4, { align: "center" });
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
    doc.setFontSize(7.2);
    doc.text(`${it ? "Anni" : "Years"} ${phase.start}-${phase.end}`, phaseX + phaseW / 2, chartBottom + 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.9);
    doc.setTextColor(...muted);
    doc.text(phaseLabel(phase, calculated, lang), phaseX + phaseW / 2, chartBottom + 11, { align: "center", maxWidth: Math.max(26, phaseW - 4) });
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.text(`${money(display.customerSaving)} / ${it ? "anno" : "year"}`, phaseX + phaseW / 2, chartBottom + 16, { align: "center" });
    phaseX += phaseW;
  });

  const legendY = chartBottom + 24;
  let legendX = x;
  keys.forEach((key) => {
    doc.setFillColor(...colorsByKey[key]);
    doc.roundedRect(legendX, legendY - 3, 3, 3, 0.5, 0.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...muted);
    doc.text(labelsByKey[key], legendX + 4.5, legendY);
    legendX += Math.min(48, 8 + labelsByKey[key].length * 1.1);
  });
}

export function repairCostEvolutionProposalPage(doc, project, calculated, pageNumber, options = {}) {
  if (!doc || !calculated || !pageNumber || pageNumber > doc.getNumberOfPages()) return false;
  const lang = options.lang === "it" ? "it" : "en";
  const it = lang === "it";
  const customerText = (value) => transformProposalCustomerText(value, project, lang);
  const teal = options.teal || [15, 118, 110];
  const navy = options.navy || [15, 23, 42];
  const muted = options.muted || [71, 85, 105];
  const light = options.light || [248, 250, 252];
  const colors = { teal, navy, muted, light };

  doc.setPage(pageNumber);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 278, "F");
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(it ? `Evoluzione dei costi e dei risparmi - ${calculated.analysisPeriod} anni` : `Cost & Savings Evolution - ${calculated.analysisPeriod} years`, 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.1);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Confronto delle fasi a prezzi costanti dell'anno 1. Ogni barra è riconciliata al 100% del costo annuo attuale; la larghezza di ogni fase corrisponde alla sua durata."
    : "Phase comparison at constant year-1 prices. Every bar reconciles to 100% of the current annual cost; each phase width reflects its duration.",
  14, 28, { maxWidth: 182 });

  drawCostChart(doc, calculated, 14, 34, 182, 126, lang, colors);

  if (safe(calculated.hybridSolarSavingEUR) > 0) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(110, 231, 183);
    doc.roundedRect(14, 164, 182, 12, 2, 2, "FD");
    doc.setTextColor(4, 120, 87);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(it
      ? `Hybrid Solar incluso: ${reportMoney(calculated.hybridSolarSavingEUR, lang)} / anno · ${reportNumber(calculated.hybridSolarSavingKwh, 0, lang)} kWh/anno di offset rete.`
      : `Hybrid Solar included: ${reportMoney(calculated.hybridSolarSavingEUR, lang)} / year · ${reportNumber(calculated.hybridSolarSavingKwh, 0, lang)} kWh/year of grid offset.`,
    105, 171.5, { align: "center", maxWidth: 174 });
  }

  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(it ? "Indicatori chiave" : "Key Indicators", 14, 188);
  const cardW = 33.6;
  const gap = 3.5;
  const energySaved = Math.max(0, safe(calculated.baselineKwh) - safe(calculated.finalKwh));
  metricCard(doc, 14, 195, cardW, 24, it ? "Riduzione energia" : "Energy reduction", `${reportNumber(calculated.energyReductionPercent, 1, lang)}%`, colors);
  metricCard(doc, 14 + (cardW + gap), 195, cardW, 24, it ? "Energia risparmiata" : "Energy saved", `${reportNumber(energySaved, 0, lang)} kWh`, colors);
  metricCard(doc, 14 + 2 * (cardW + gap), 195, cardW, 24, it ? "Beneficio Hybrid" : "Hybrid benefit", reportMoney(calculated.hybridSolarSavingEUR || 0, lang), colors);
  metricCard(doc, 14 + 3 * (cardW + gap), 195, cardW, 24, it ? "Riduzione CO2" : "CO2 reduction", `${reportNumber(safe(calculated.co2ReductionKg) / 1000, 1, lang)} t/${it ? "anno" : "yr"}`, colors);
  metricCard(doc, 14 + 4 * (cardW + gap), 195, cardW, 24, it ? "Punti Smart" : "Smart points", reportNumber(calculated.lcuQuantity, 0, lang), colors);

  autoTable(doc, {
    startY: 228,
    theme: "grid",
    head: [[it ? "Indicatore economico / baseline" : "Economic / baseline indicator", it ? "Valore" : "Value"]],
    body: [
      [customerText(it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit"), reportMoney(calculated.customerAnnualNetBenefit, lang)],
      [it ? "Profilo dimmer esistente" : "Existing dimming profile", dimmingSummaryValue(project, calculated, lang)],
      [it ? "Payback operativo (escl. finanziamento)" : "Operational payback (excl. financing)", calculated.payback == null ? "-" : `${reportNumber(calculated.payback, 1, lang)} ${it ? "anni" : "yrs"}`],
      [calculated.dealType === "cash" ? (it ? "Investimento iniziale" : "Initial investment") : (it ? "CAPEX progetto / investimento finanziato" : "Project CAPEX / financed investment"), reportMoney(calculated.totalCapex, lang)],
    ],
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 6.7, cellPadding: 1.1, overflow: "linebreak" },
    columnStyles: { 0: { halign: "left", cellWidth: 55 }, 1: { halign: "right" } },
    didParseCell: alignedTable({ 0: "left", 1: "right" }).didParseCell,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(it
    ? "La visualizzazione usa la stessa logica economica del dashboard Intelligence e valori a prezzi costanti dell'anno 1; il cash flow mantiene invece le indicizzazioni annuali previste dal Business Case."
    : "The visualization uses the same economic logic as the Intelligence dashboard and constant year-1 prices; the cash flow continues to apply the annual escalations configured in the Business Case.",
  14, 267, { maxWidth: 182 });
  return true;
}
