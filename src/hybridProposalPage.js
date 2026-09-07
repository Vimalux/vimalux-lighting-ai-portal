import autoTable from "jspdf-autotable";
import { alignedTable, reportMoney, reportNumber } from "./reportPresentation.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const MONTHS_IT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildHybridMonthlyReport(calculated, lang = "it") {
  const hybrid = calculated?.hybridSolar || {};
  if (!hybrid.enabled) return null;

  const annualGridOffsetKwh = Math.max(0, safe(calculated?.hybridSolarSavingKwh));
  const annualHybridBenefit = Math.max(0, safe(calculated?.hybridSolarSavingEUR));
  const totalUsableSolarKwh = Math.max(0, safe(hybrid?.totalUsableSolarKwh));
  const includedRatio = totalUsableSolarKwh > 0
    ? Math.min(1, annualGridOffsetKwh / totalUsableSolarKwh)
    : 0;
  const months = lang === "it" ? MONTHS_IT : MONTHS_EN;
  const energyPrice = annualGridOffsetKwh > 0
    ? annualHybridBenefit / annualGridOffsetKwh
    : 0;

  const monthly = (Array.isArray(hybrid?.monthlyTotals) ? hybrid.monthlyTotals : []).map((row, index) => {
    const pvKwh = Math.max(0, safe(row?.pvKwh));
    const usableSolarKwh = Math.max(0, safe(row?.usableSolarKwh));
    const gridOffsetKwh = usableSolarKwh * includedRatio;
    const loadKwh = Math.max(0, safe(row?.loadKwh));
    return {
      month: index + 1,
      label: months[index] || String(index + 1),
      pvKwh,
      usableSolarKwh,
      gridOffsetKwh,
      benefitEur: gridOffsetKwh * energyPrice,
      contributionPercent: loadKwh > 0 ? gridOffsetKwh / loadKwh * 100 : 0,
    };
  });

  const installedPvKwp = (Array.isArray(hybrid?.rows) ? hybrid.rows : []).reduce(
    (sum, row) => sum + Math.max(0, safe(row?.quantity)) * Math.max(0, safe(row?.pvWp)) / 1000,
    0,
  );

  return {
    units: Math.max(0, safe(hybrid?.totalHybridUnits)),
    installedPvKwp,
    annualPvKwh: Math.max(0, safe(hybrid?.totalPvKwh)),
    annualUsableSolarKwh: totalUsableSolarKwh,
    annualGridOffsetKwh,
    annualHybridBenefit,
    annualContributionPercent: Math.max(0, safe(hybrid?.totalContributionPercent)),
    annualYieldKwhPerKwp: Math.max(0, safe(hybrid?.solarYieldKwhPerKwp)),
    monthly,
    location: hybrid?.location || {},
    dataLevel: hybrid?.dataLevel || "",
  };
}

function metricCard(doc, x, y, w, h, label, value, colors) {
  const { navy, muted, light, teal } = colors;
  doc.setFillColor(...light);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(label, x + 3.5, y + 5.5, { maxWidth: w - 7 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...navy);
  doc.text(value, x + 3.5, y + h - 4.5, { maxWidth: w - 7 });
  doc.setDrawColor(...teal);
  doc.setLineWidth(0.5);
  doc.line(x + 3.5, y + h - 2.2, x + w - 3.5, y + h - 2.2);
}

function groupedMonthlyChart(doc, data, x, y, w, h, lang, colors) {
  const rows = data.monthly || [];
  if (!rows.length) return;
  const { teal, muted } = colors;
  const solarColor = [245, 158, 11];
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.pvKwh, row.gridOffsetKwh]));
  const left = x + 13;
  const bottom = y + h - 13;
  const top = y + 5;
  const chartW = w - 18;
  const chartH = bottom - top;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i += 1) {
    const yy = bottom - chartH * i / 4;
    const value = maxValue * i / 4;
    doc.line(left, yy, left + chartW, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...muted);
    doc.text(reportNumber(value, 0, lang), left - 2, yy + 1.8, { align: "right" });
  }

  const slot = chartW / rows.length;
  const barW = Math.min(4.4, slot * 0.3);
  rows.forEach((row, index) => {
    const center = left + slot * (index + 0.5);
    const pvH = chartH * row.pvKwh / maxValue;
    const gridH = chartH * row.gridOffsetKwh / maxValue;
    doc.setFillColor(...solarColor);
    doc.rect(center - barW - 0.7, bottom - pvH, barW, pvH, "F");
    doc.setFillColor(...teal);
    doc.rect(center + 0.7, bottom - gridH, barW, gridH, "F");
    doc.setFontSize(5.6);
    doc.setTextColor(...muted);
    doc.text(row.label, center, bottom + 5, { align: "center" });
  });

  const legendY = y + h + 2;
  doc.setFillColor(...solarColor); doc.rect(x + 38, legendY - 2.6, 3.2, 3.2, "F");
  doc.setFontSize(6.2); doc.setTextColor(...muted);
  doc.text(lang === "it" ? "Produzione PV" : "PV production", x + 43, legendY);
  doc.setFillColor(...teal); doc.rect(x + 100, legendY - 2.6, 3.2, 3.2, "F");
  doc.text(lang === "it" ? "Offset rete incluso BC" : "Grid offset included in BC", x + 105, legendY);
}

export function appendHybridProposalPage(doc, project, calculated, options = {}) {
  const lang = options.lang === "it" ? "it" : "en";
  const it = lang === "it";
  const teal = options.teal || [15, 118, 110];
  const navy = options.navy || [15, 23, 42];
  const muted = options.muted || [71, 85, 105];
  const light = options.light || [248, 250, 252];
  const colors = { teal, navy, muted, light };
  const data = buildHybridMonthlyReport(calculated, lang);
  if (!data || !data.monthly.some((row) => row.pvKwh > 0 || row.gridOffsetKwh > 0)) return false;

  doc.addPage();
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(it ? "Hybrid Solar - profilo mensile e beneficio economico" : "Hybrid Solar - monthly profile and economic benefit", 14, 20);
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.text(it
    ? "La produzione fotovoltaica varia durante l'anno. Il Business Case valorizza solo l'energia solare realmente utilizzabile per ridurre il prelievo dalla rete, dopo i limiti di carico, batteria e rendimento del sistema."
    : "PV production varies throughout the year. The Business Case values only solar energy that can actually reduce grid consumption, after luminaire-load, battery and system-efficiency limits.",
  14, 28, { maxWidth: 182 });

  const cardW = 33.6;
  const gap = 3.5;
  const cardY = 39;
  metricCard(doc, 14, cardY, cardW, 22, it ? "Unità ibride" : "Hybrid units", reportNumber(data.units, 0, lang), colors);
  metricCard(doc, 14 + (cardW + gap), cardY, cardW, 22, it ? "PV installato" : "Installed PV", `${reportNumber(data.installedPvKwp, 2, lang)} kWp`, colors);
  metricCard(doc, 14 + 2 * (cardW + gap), cardY, cardW, 22, it ? "Produzione PV annua" : "Annual PV production", `${reportNumber(data.annualPvKwh, 0, lang)} kWh`, colors);
  metricCard(doc, 14 + 3 * (cardW + gap), cardY, cardW, 22, it ? "Offset rete nel BC" : "BC grid offset", `${reportNumber(data.annualGridOffsetKwh, 0, lang)} kWh`, colors);
  metricCard(doc, 14 + 4 * (cardW + gap), cardY, cardW, 22, it ? "Beneficio Hybrid annuo" : "Annual Hybrid benefit", reportMoney(data.annualHybridBenefit, lang), colors);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text(it ? "Variazione mensile" : "Monthly variation", 14, 74);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Le barre arancioni mostrano la produzione PV teoricamente disponibile; le barre verdi mostrano l'energia effettivamente contabilizzata come offset rete nel Business Case."
    : "Orange bars show available PV production; green bars show the energy actually counted as grid offset in the Business Case.",
  14, 80, { maxWidth: 182 });
  groupedMonthlyChart(doc, data, 14, 85, 182, 78, lang, colors);

  autoTable(doc, {
    startY: 174,
    theme: "grid",
    head: [[
      it ? "Mese" : "Month",
      it ? "Produzione PV" : "PV production",
      it ? "Solare utilizzabile" : "Usable solar",
      it ? "Offset rete BC" : "BC grid offset",
      it ? "Beneficio" : "Benefit",
    ]],
    body: [
      ...data.monthly.map((row) => [
        row.label,
        `${reportNumber(row.pvKwh, 0, lang)} kWh`,
        `${reportNumber(row.usableSolarKwh, 0, lang)} kWh`,
        `${reportNumber(row.gridOffsetKwh, 0, lang)} kWh`,
        reportMoney(row.benefitEur, lang),
      ]),
      [
        it ? "Totale annuo" : "Annual total",
        `${reportNumber(data.annualPvKwh, 0, lang)} kWh`,
        `${reportNumber(data.annualUsableSolarKwh, 0, lang)} kWh`,
        `${reportNumber(data.annualGridOffsetKwh, 0, lang)} kWh`,
        reportMoney(data.annualHybridBenefit, lang),
      ],
    ],
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 6.0, cellPadding: 0.75 },
    columnStyles: {
      0: { halign: "left", cellWidth: 24 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
    didParseCell: alignedTable({ 0: "left", 1: "right", 2: "right", 3: "right", 4: "right" }).didParseCell,
    margin: { left: 14, right: 14, bottom: 18 },
  });

  const location = data.location || {};
  const resolvedName = String(location.resolvedName || location.query || project?.customer?.name || project?.project?.name || "-");
  const source = String(location.solarSource || "European Commission JRC PVGIS 5.3");
  const sourceY = Math.min(270, doc.lastAutoTable.finalY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? `Dati solari: ${resolvedName} | ${source} | resa annua ${reportNumber(data.annualYieldKwhPerKwp, 0, lang)} kWh/kWp. Il beneficio economico coincide con l'offset rete incluso nel Business Case e non con tutta la produzione PV.`
    : `Solar data: ${resolvedName} | ${source} | annual yield ${reportNumber(data.annualYieldKwhPerKwp, 0, lang)} kWh/kWp. The economic benefit equals the grid offset included in the Business Case, not total PV production.`,
  14, sourceY, { maxWidth: 182 });
  return true;
}
