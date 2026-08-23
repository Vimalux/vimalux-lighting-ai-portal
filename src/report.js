
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, formatNumber, formatPercent, useT } from "./i18n.js";
import { aggregateReplacementRows } from "./reportSummary.js";
import { reportCommercialContext } from "./reportCommercial.js";
import { warrantyLabel } from "./warranty.js";

export function generateCustomerPdf(project, result) {
  const lang = project.language;
  const t = useT(lang);
  const it = lang === "it";
  const money = (value) => formatMoney(value, lang, project.project.currency);
  const money2 = (value) => formatMoney(value, lang, project.project.currency, 2);
  const percent = (value) => formatPercent(value, lang);
  const commercial = reportCommercialContext(project, result);
  const { projectType, financed } = commercial;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const alignTableHeaders = (...alignments) => (data) => {
    if (data.section === "head") data.cell.styles.halign = alignments[data.column.index] || "left";
  };
  const section = (text, y) => {
    doc.setTextColor(15, 118, 110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, 14, y);
    doc.setTextColor(15, 23, 42);
  };
  const rows = (items) => items.filter((item) => item && item[1] !== "" && item[1] != null).map(([label, value]) => [label, String(value)]);
  const drawCustomerValueChart = () => {
    const chartRows = result.customerValueRows || [];
    const first = chartRows[0];
    if (!first) return;
    const postContract = result.serviceAgreementPeriod < result.analysisPeriod ? chartRows[result.serviceAgreementPeriod] : null;
    const parts = (row, fullSmart = false) => fullSmart
      ? [{ value: Math.max(0, row.currentOperatingCost - row.fullSmartBenefit), color: [79, 183, 185] }, { value: row.fullSmartOpex, color: [245, 158, 11] }, { value: row.investmentPayment, color: [148, 163, 184] }, { value: row.fullSmartNetBenefit, color: [22, 163, 74] }]
      : [{ value: row.futureOperatingCost, color: [79, 183, 185] }, { value: row.servicePayment, color: [245, 158, 11] }, { value: row.investmentPayment, color: [148, 163, 184] }, { value: row.customerSaving, color: [22, 163, 74] }];
    const financingChanges = result.financingPeriod < result.analysisPeriod && chartRows[result.financingPeriod - 1]?.investmentPayment !== chartRows[result.financingPeriod]?.investmentPayment;
    const phaseStarts = [...new Set([1, financingChanges ? result.financingPeriod + 1 : null, result.serviceAgreementPeriod + 1].filter((year) => year && year <= result.analysisPeriod))].sort((a, b) => a - b);
    const phases = phaseStarts.map((start, index) => ({ start, end: (phaseStarts[index + 1] || result.analysisPeriod + 1) - 1, row: chartRows[start - 1], smart: start <= result.serviceAgreementPeriod }));
    const top = 36, chartHeight = 68, currentX = 18, currentWidth = 30, timelineX = 58, timelineWidth = 134;
    section(it ? `Evoluzione dei costi e dei risparmi - ${result.analysisPeriod} anni` : `Cost and savings development - ${result.analysisPeriod} years`, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(it ? "La larghezza di ogni fase corrisponde alla sua durata. La linea superiore rappresenta il costo annuo attuale." : "Each phase width reflects its duration. The upper line represents the current annual cost.", 18, 24);
    const drawStack = (row, bx, width) => {
      let bottom = top + chartHeight;
      const segment = (value, color) => {
        const h = Math.max(0, value) / Math.max(1, row.currentOperatingCost) * chartHeight;
        if (!h) return;
        bottom -= h;
        doc.setFillColor(...color); doc.rect(bx, bottom, width, h, "F");
        if (h >= 9 && width >= 28) {
          doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
          doc.text(`${Math.round(value / row.currentOperatingCost * 100)}%`, bx + width / 2, bottom + h / 2 + 1, { align: "center" });
        }
      };
      parts(row).forEach((part) => segment(part.value, part.color));
    };
    doc.setFillColor(15, 111, 174); doc.rect(currentX, top, currentWidth, chartHeight, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("100%", currentX + currentWidth / 2, top + chartHeight / 2, { align: "center" });
    doc.setFontSize(6); doc.text(money(first.currentOperatingCost), currentX + currentWidth / 2, top + chartHeight / 2 + 5, { align: "center" });
    doc.setDrawColor(100, 116, 139); doc.setLineDashPattern([2, 1], 0); doc.line(timelineX, top, timelineX + timelineWidth, top); doc.setLineDashPattern([], 0);
    doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.text(`100% · ${money(first.currentOperatingCost)} / ${it ? "anno" : "year"}`, timelineX + timelineWidth, top - 2, { align: "right" });
    let phaseX = timelineX;
    phases.forEach((phase) => {
      const duration = phase.end - phase.start + 1;
      const width = timelineWidth * duration / result.analysisPeriod;
      drawStack(phase.row, phaseX, width);
      doc.setDrawColor(255, 255, 255); doc.line(phaseX + width, top, phaseX + width, top + chartHeight);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.text(`${it ? "Anni" : "Years"} ${phase.start}-${phase.end}`, phaseX + width / 2, top + chartHeight + 6, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(71, 85, 105);
      const phaseLabel = phase.row.investmentPayment > 0 ? (it ? "Finanziamento + Smart" : "Financing + Smart") : phase.smart ? (it ? "Smart senza finanziamento" : "Smart without financing") : (it ? "Dopo il contratto Smart" : "After the Smart contract");
      doc.text(phaseLabel, phaseX + width / 2, top + chartHeight + 11, { align: "center", maxWidth: width - 3 });
      doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42); doc.text(`${money(phase.row.customerSaving)} / ${it ? "anno" : "year"}`, phaseX + width / 2, top + chartHeight + 17, { align: "center", maxWidth: width - 3 });
      phaseX += width;
    });
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(15, 23, 42); doc.text(it ? "Situazione attuale" : "Current situation", currentX + currentWidth / 2, top + chartHeight + 7, { align: "center" });
    const legend = [[it ? "Costo operativo post-upgrade" : "Post-upgrade operating cost", [79, 183, 185]], [it ? "OPEX servizi" : "Service OPEX", [245, 158, 11]], [it ? "Pagamento contratto / investimento" : "Contract / investment payment", [148, 163, 184]], [it ? "Risparmio netto cliente" : "Customer net saving", [22, 163, 74]]];
    legend.forEach(([label, color], index) => {
      const lx = 18 + (index % 2) * 90, ly = 132 + Math.floor(index / 2) * 8;
      doc.setFillColor(...color); doc.rect(lx, ly - 3, 4, 4, "F");
      doc.setTextColor(71, 85, 105); doc.setFontSize(7.5); doc.text(label, lx + 6, ly);
    });
    if (result.cmsEnabled && postContract) {
      const boxY = 158;
      doc.setFillColor(236, 253, 245); doc.setDrawColor(167, 243, 208); doc.roundedRect(18, boxY, 174, 32, 2, 2, "FD");
      const comparison = [[it ? `Senza Smart - anni ${postContract.year}-${result.analysisPeriod}` : `Without Smart - years ${postContract.year}-${result.analysisPeriod}`, `${money(postContract.customerSaving)} / ${it ? "anno" : "year"}`], [it ? `Con Smart - anni ${postContract.year}-${result.analysisPeriod}` : `With Smart - years ${postContract.year}-${result.analysisPeriod}`, `${money(postContract.fullSmartNetBenefit)} / ${it ? "anno" : "year"}`], [it ? "Beneficio aggiuntivo Smart" : "Additional Smart benefit", `${money(postContract.fullSmartNetBenefit - postContract.customerSaving)} / ${it ? "anno" : "year"}`]];
      comparison.forEach(([label, value], index) => { const cx = 24 + index * 56; doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(label, cx, boxY + 8, { maxWidth: 50 }); doc.setTextColor(index === 2 && result.fullSmartIncrementalSavings < 0 ? 190 : 4, index === 2 && result.fullSmartIncrementalSavings < 0 ? 18 : 120, index === 2 && result.fullSmartIncrementalSavings < 0 ? 60 : 87); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(value, cx, boxY + 20, { maxWidth: 50 }); });
      doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105); doc.setFontSize(6.5); doc.text(`${it ? "Beneficio aggiuntivo totale" : "Total additional benefit"}: ${money(result.fullSmartIncrementalSavings)}. ${result.powerAidEnabled ? (it ? "PowerAiD incluso solo quando genera un risparmio incrementale." : "PowerAiD included only when it generates incremental savings.") : (it ? "PowerAiD non incluso nello scenario." : "PowerAiD is not included in the scenario.")}`, 24, boxY + 27, { maxWidth: 160 });
    } else if (result.cmsEnabled) {
      doc.setFillColor(236, 253, 245); doc.setDrawColor(167, 243, 208); doc.roundedRect(42, 158, 126, 16, 2, 2, "FD"); doc.setTextColor(4, 120, 87); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text(it ? `Smart attivo per l'intero periodo di analisi - ${result.analysisPeriod} anni` : `Smart active throughout the full analysis period - ${result.analysisPeriod} years`, 105, 168, { align: "center" });
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("VIMALUX Intelligence", 14, 17);
  doc.setFontSize(14);
  doc.text(it ? "Studio Preliminare di Fattibilità Economica" : "Preliminary Business Case", 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${project.project.businessCaseId}  |  ${project.customer.name || "-"}  |  ${project.project.date}`, 14, 36);
  doc.setTextColor(15, 23, 42);

  section(it ? "Sintesi Esecutiva" : "Executive Summary", 52);
  const paybackLabel = it ? "Tempo di ritorno operativo" : "Operational payback";
  const paymentLabel = result.dealType === "noleggio_operativo"
    ? (it ? "Canone mensile" : "Monthly canone")
    : result.dealType === "finance"
      ? (it ? "Rata finanziamento" : "Financing payment")
      : t("monthlyPayment");
  const paymentValue = result.dealType === "finance"
    ? result.financingMonthlyPayment
    : result.monthlyPayment;
  autoTable(doc, {
    startY: 57,
    theme: "grid",
    head: [[t("preliminary"), t("capex"), paymentLabel, it ? "OPEX mensile" : "Monthly OPEX", `${t("annualNet")}*`, t("roi"), paybackLabel]],
    body: [[result.customerDecisionStatus.replace("_", "-"), money(result.totalCapex), money2(paymentValue), money2(result.totalAnnualOpex / 12), money(result.customerAnnualNetBenefit), percent(result.roiPercent), result.payback == null ? t("notAvailable") : `${formatNumber(result.payback, lang, 1)} ${t("years")}`]],
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 6.9, cellPadding: 1.8, valign: "middle" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: alignTableHeaders("left", "right", "right", "right", "right", "right"),
  });
  doc.setFontSize(10);
  doc.text(t(result.customerDecisionStatus), 14, doc.lastAutoTable.finalY + 8, { maxWidth: 182 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(commercial.annualNetFootnote, 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
  doc.setFont("helvetica", "normal");
  doc.text(`${t("energyReduction")}: ${percent(result.energyReductionPercent)}   |   ${it ? "Riduzione CO2" : "CO2 reduction"}: ${formatNumber(result.co2ReductionKg / 1000, lang, 1)} t/${it ? "anno" : "year"}`, 14, doc.lastAutoTable.finalY + 19, { maxWidth: 182 });
  doc.setTextColor(15, 23, 42);

  section(it ? "Cliente e progetto" : "Customer and project", doc.lastAutoTable.finalY + 33);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 38,
    theme: "plain",
    body: rows([[it ? "Cliente" : "Customer", project.customer.name], [it ? "Provincia" : "Province", project.customer.province], [it ? "Regione" : "Region", project.customer.region], [it ? "Contatto" : "Contact", project.customer.contact], ["Email", project.customer.email], [it ? "Telefono" : "Telephone", project.customer.telephone], [it ? "Progetto" : "Project", project.project.name], [it ? "Consulente" : "Consultant", project.project.consultant], [it ? "Data" : "Date", project.project.date], [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)]]),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.4, halign: "left" },
  });

  section(it ? "Assunzioni principali" : "Key assumptions", doc.lastAutoTable.finalY + 8);
  const technology = [...new Set(project.groups.map((group) => group.technology))].join(", ");
  const averageExistingWattage = result.totalQuantity ? result.groupRows.reduce((sum, group) => sum + group.quantity * Number(group.existingWattage || 0), 0) / result.totalQuantity : 0;
  const proposedProducts = [...new Set(result.groupRows.filter((group) => group.upgradeSelected).map((group) => group.product?.name).filter(Boolean))].join(", ");
  const proposedWattages = [...new Set(result.groupRows.filter((group) => group.upgradeSelected).map((group) => Number(group.product?.wattage || 0)).filter(Boolean))].sort((a, b) => a - b).map((value) => `${formatNumber(value, lang)} W`).join(", ");
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 13,
    theme: "striped",
    body: rows([
      [it ? "Numero apparecchi" : "Number of luminaires", formatNumber(result.totalQuantity, lang)],
      [it ? "Apparecchi selezionati per upgrade" : "Luminaires selected for upgrade", formatNumber(result.upgradedQuantity, lang)],
      [it ? "Apparecchi non sostituiti" : "Luminaires not upgraded", formatNumber(result.notUpgradedQuantity, lang)],
      [it ? "Tecnologia esistente" : "Existing technology", technology],
      [it ? "Potenza media esistente" : "Average existing wattage", `${formatNumber(averageExistingWattage, lang, 1)} W`],
      [it ? "Prodotto LED proposto" : "Proposed LED product", proposedProducts],
      [it ? "Potenza LED proposta" : "Proposed LED wattage", proposedWattages],
      [it ? "Ore operative" : "Operating hours", formatNumber(project.assumptions.operatingHours, lang)],
      [it ? "Prezzo energia" : "Energy price", `${formatMoney(project.assumptions.energyPrice, lang, project.project.currency, 2)}/kWh`],
      [it ? "Profilo dimmer esistente" : "Existing dimming profile", [...new Set(result.groupRows.map((g) => g.existingDimmingProfile === "fixed" ? `Fixed ${formatNumber(g.dimmingPercent, lang, 1)}%${g.existingDimmingNote ? ` (${g.existingDimmingNote})` : ""}` : "None"))].join(", ")],
      [it ? "Periodo di finanziamento" : "Financing Period", `${result.financingPeriod} ${t("years")}`],
      [it ? "Periodo accordo servizi" : "Service Agreement Period", `${result.serviceAgreementPeriod} ${t("years")}`],
      [it ? "Tipo di progetto" : "Project type", projectType],
      financed ? [it ? "Tasso di interesse" : "Interest rate", percent(project.assumptions.interestRate)] : null,
      financed ? [it ? "Anticipo cliente" : "Customer upfront payment", money(project.assumptions.upfrontPayment)] : null,
      [it ? "Aumento prezzo energia" : "Energy escalation", percent(project.assumptions.energyEscalation)],
      [it ? "Aumento OPEX" : "OPEX escalation", percent(project.assumptions.opexEscalation)],
      [it ? "Tasso di attualizzazione" : "Discount rate", percent(project.assumptions.discountRate)],
      [it ? "Periodo di analisi" : "Analysis period", `${project.assumptions.analysisPeriod} ${t("years")}`],
      ["Smart Lighting", result.smartEnabled ? t("yes") : t("no")],
      [it ? "Quantità LCU calcolata" : "Calculated LCU quantity", result.lcuQuantity],
      ["CMS", result.cmsEnabled ? t("yes") : t("no")],
      ["PowerAiD", result.powerAidEnabled ? t("yes") : t("no")],
      ["CLO", percent(result.smartEnabled ? project.assumptions.cloPercent : 0)],
      result.powerAidEnabled ? [it ? "Riduzione PowerAiD" : "PowerAiD reduction", percent(project.assumptions.powerAidPercent)] : null,
    ]),
    styles: { font: "helvetica", fontSize: 7.3, cellPadding: 1.05 },
    columnStyles: { 0: { halign: "left", cellWidth: 98 }, 1: { halign: "left" } },
  });

  doc.addPage();
  section(it ? "Soluzione proposta" : "Proposed solution summary", 18);
  const replacementRows = aggregateReplacementRows(result.groupRows.filter((group) => group.upgradeSelected));
  autoTable(doc, {
    startY: 23,
    head: [[it ? "Tecnologia esistente" : "Existing technology", it ? "Potenza esistente" : "Existing wattage", it ? "Quantità" : "Quantity", it ? "Nuovo prodotto LED" : "New LED product", it ? "Potenza impostata" : "Configured wattage"]],
    body: replacementRows.map((row) => [row.technology, `${formatNumber(row.existingWattage, lang)} W`, formatNumber(row.quantity, lang), row.productName, `${formatNumber(row.configuredLedWattage, lang)} W`]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 8, valign: "middle" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "left" }, 4: { halign: "right" } },
    didParseCell: alignTableHeaders("left", "right", "right", "left", "right"),
  });

  if (result.smartEnabled) {
    section(it ? "Hardware Smart Lighting" : "Smart Lighting hardware", doc.lastAutoTable.finalY + 9);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [[it ? "Componente" : "Component", it ? "Quantità" : "Quantity", it ? "Prodotto" : "Product"]],
      body: [["LCU", result.lcuQuantity, result.hardware.lcu.name || "-"], ["Gateway", result.hardware.gatewayQty, result.hardware.gateway.name || "-"], ["Antenna", result.hardware.antennaQty, result.hardware.antenna.name || "-"], [it ? "Contatore" : "Energy meter", result.hardware.meterQty, result.hardware.meter.name || "-"]].filter(([, quantity]) => quantity > 0).map(([component, quantity, product]) => [component, formatNumber(quantity, lang), product]),
      headStyles: { fillColor: [15, 118, 110] },
      styles: { font: "helvetica", fontSize: 8, valign: "middle" },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right", cellWidth: 32 }, 2: { halign: "left" } },
      didParseCell: alignTableHeaders("left", "right", "left"),
    });
  }

  section(it ? "Risultato energetico ed economico" : "Energy and economic result", doc.lastAutoTable.finalY + 9);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    theme: "striped",
    body: rows([[it ? "Consumo nominale di sistema" : "Nominal system consumption", `${formatNumber(result.nominalSystemKwh, lang)} kWh`], [it ? "Riduzione dimmer esistente" : "Existing fixed dimming reduction", `${formatNumber(result.existingDimmingSavingKwh, lang)} kWh`], [it ? "Baseline intera installazione" : "Whole-installation baseline", `${formatNumber(result.baselineKwh, lang)} kWh`], [it ? "Baseline apparecchi selezionati" : "Selected-luminaire baseline", `${formatNumber(result.upgradedBaselineKwh, lang)} kWh`], [it ? "Consumo apparecchi non sostituiti" : "Non-upgraded consumption", `${formatNumber(result.notUpgradedBaselineKwh, lang)} kWh`], [it ? "Consumo LED / installazione post-upgrade" : "LED / post-upgrade installation consumption", `${formatNumber(result.ledKwh, lang)} kWh`], [t("ledSaving"), `${formatNumber(result.ledSavingKwh, lang)} kWh`], [t("cloSaving"), `${formatNumber(result.cloSavingKwh, lang)} kWh`], [it ? "Consumo dopo CLO" : "Consumption after CLO", `${formatNumber(result.afterCloKwh, lang)} kWh`], [t("powerSaving"), `${formatNumber(result.powerAidSavingKwh, lang)} kWh`], [it ? "Consumo finale apparecchi aggiornati" : "Upgraded-luminaire final consumption", `${formatNumber(result.upgradedFinalKwh, lang)} kWh`], [it ? "Consumo finale intera installazione" : "Whole-installation final consumption", `${formatNumber(result.finalKwh, lang)} kWh`], [it ? "Riduzione apparecchi aggiornati" : "Upgraded-luminaire reduction", percent(result.upgradedEnergyReductionPercent)], [it ? "Riduzione intera installazione" : "Whole-installation reduction", percent(result.energyReductionPercent)], [it ? "Riduzione CO2" : "CO2 reduction", `${formatNumber(result.co2ReductionKg / 1000, lang, 1)} ${it ? "t/anno" : "t/year"}`], [t("maintenanceSaving"), money(result.maintenanceSaving)], [t("annualOpex"), money2(result.totalAnnualOpex)], [t("npv"), money(result.npv)], [`${t("lifecycle")} - ${result.analysisPeriod} ${t("years")}`, money(result.lifecycleResult)]]),
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 0.7 },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
  });

  const additionalCostRows = (type, formatter) => (project.additionalCosts || [])
    .filter((item) => item?.costType === type && Number(item.quantity || 0) * Number(item.unitSalesPrice || 0) > 0)
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitSalesPrice || 0);
      const label = item.description?.trim() || (it ? "Costo aggiuntivo" : "Additional cost");
      const details = `${formatNumber(quantity, lang)} ${item.unit || ""} × ${money2(unitPrice)}`.trim();
      return [`${label} · ${details}`, formatter(quantity * unitPrice)];
    });
  const additionalCapexRows = additionalCostRows("capex", money);
  const additionalAnnualOpexRows = additionalCostRows("opex_annual", money2);

  section(it ? "Dettaglio CAPEX e OPEX" : "CAPEX and OPEX breakdown", doc.lastAutoTable.finalY + 9);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    margin: { bottom: 18 },
    head: [[it ? "Voce" : "Item", it ? "Importo" : "Amount"]],
    body: rows([
      [it ? "Apparecchi LED" : "LED luminaires", money(result.ledCapex)],
      ["LCU", money(result.smartHardwareCapex)],
      [it ? "Implementazione" : "Implementation", money(result.implementationCapex)],
      ["Gateway", money(result.gatewayCapex)],
      [it ? "Antenne" : "Antennas", money(result.antennaCapex)],
      [it ? "Contatori" : "Meters", money(result.meterCapex)],
      [it ? "Trasporto" : "Freight", money(result.freight)],
      ...additionalCapexRows,
      [t("capex"), money(result.totalCapex)],
      ["CMS", money2(result.cmsOpex)],
      ["Gateway OPEX", money2(result.gatewayOpex)],
      ["PowerAiD fee", money2(result.powerAidFee)],
      ...additionalAnnualOpexRows,
      [t("annualOpex"), money2(result.totalAnnualOpex)],
    ]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 6.6, cellPadding: 0.55 },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right", cellWidth: 46 } },
    didParseCell: alignTableHeaders("left", "right"),
  });

  doc.addPage();
  drawCustomerValueChart();

  doc.addPage();
  section(it ? "Flusso di cassa cliente" : "Customer cash flow", 18);
  autoTable(doc, {
    startY: 23,
    margin: { bottom: 18 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: [[it ? "Anno" : "Year", it ? "Beneficio lordo" : "Gross benefit", "OPEX", it ? "Pagamento" : "Payment", it ? "Flusso netto" : "Net cash flow", it ? "Cumulato" : "Cumulative"]],
    body: result.cashFlowRows.map((row) => [row.year, money(row.grossBenefit), commercial.opexIncludedInPayment ? commercial.includedLabel : money2(row.opex), money2(row.payment), money(row.netCashFlow), money(row.cumulative)]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 7.3, cellPadding: 1.5, valign: "middle" },
    columnStyles: { 0: { halign: "center" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    didParseCell: alignTableHeaders("center", "right", "right", "right", "right", "right"),
  });

  let y = doc.lastAutoTable.finalY + 9;
  if (y > 244) {
    doc.addPage();
    y = 18;
  }
  section(it ? "Prossimo passo" : "Next step", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(it ? "Censimento GPS - classificazione UNI 11248 - progettazione illuminotecnica - assegnazione prodotti - proposta tecnica finale in VIMALUX Planner" : "GPS census - UNI 11248 classification - photometric design - product assignment - final technical proposal in VIMALUX Planner", 14, y + 6, { maxWidth: 182 });
  const disclaimer = it ? "Questa analisi rappresenta una valutazione preliminare basata su quantità aggregate, potenze medie e ipotesi commerciali. Le quantità definitive, il censimento GPS, la classificazione stradale, le verifiche UNI 11248, la progettazione illuminotecnica e l'assegnazione finale dei prodotti saranno sviluppati tramite VIMALUX Planner." : "This analysis is a preliminary assessment based on aggregated quantities, average wattages and commercial assumptions. Final quantities, the GPS census, road classification, UNI 11248 verification, photometric design and final product assignment will be developed through VIMALUX Planner.";
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(disclaimer, 14, y + 18, { maxWidth: 182 });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 281, 196, 281);
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`${project.project.businessCaseId}  |  ${project.project.date}  |  VIMALUX Intelligence`, 14, 286);
    doc.text(`${it ? "Pagina" : "Page"} ${page} ${it ? "di" : "of"} ${pages}  |  v1.0`, 164, 286);
  }
  doc.save(`VIMALUX_${project.project.businessCaseId || "Business_Case"}.pdf`);
}
