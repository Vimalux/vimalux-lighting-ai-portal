
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, formatNumber, formatPercent, useT } from "./i18n.js";
import { aggregateReplacementRows } from "./reportSummary.js";
import { reportCommercialContext } from "./reportCommercial.js";

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
    const scenarios = [{ label: it ? "Situazione attuale" : "Current situation", current: true, row: first }, { label: it ? "Durante il contratto" : "During the contract", year: 1, row: first }];
    if (postContract) scenarios.push({ label: it ? "Dopo il contratto\nsenza Smart" : "After contract\nwithout Smart", year: postContract.year, row: postContract }, { label: it ? "Smart mantenuto" : "Smart continued", year: postContract.year, row: postContract, fullSmart: true });
    const top = 32, chartHeight = 92, barWidth = 30, gap = scenarios.length === 4 ? 14 : 34;
    const chartWidth = scenarios.length * barWidth + (scenarios.length - 1) * gap;
    const x = (210 - chartWidth) / 2;
    section(it ? "Ripartizione del costo annuo e del risparmio cliente" : "Annual cost allocation and customer savings", 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(it ? "Costo operativo post-upgrade, servizi, pagamento contrattuale e risparmio netto del cliente." : "Post-upgrade operating cost, services, contracted payment and customer net saving.", 18, 24);
    doc.setDrawColor(148, 163, 184); doc.line(x - 6, top + chartHeight, x + chartWidth + 6, top + chartHeight);
    scenarios.forEach((scenario, index) => {
      const bx = x + index * (barWidth + gap);
      let bottom = top + chartHeight;
      const segment = (value, color) => {
        const h = Math.max(0, value) / Math.max(1, scenario.row.currentOperatingCost) * chartHeight;
        if (!h) return;
        bottom -= h;
        doc.setFillColor(...color); doc.rect(bx, bottom, barWidth, h, "F");
        if (h >= 12) {
          doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
          doc.text(`${Math.round(value / scenario.row.currentOperatingCost * 100)}%`, bx + barWidth / 2, bottom + h / 2, { align: "center" });
        }
      };
      if (scenario.current) segment(scenario.row.currentOperatingCost, [15, 111, 174]);
      else parts(scenario.row, scenario.fullSmart).forEach((part) => segment(part.value, part.color));
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(15, 23, 42);
      doc.text(scenario.label.split("\n"), bx + barWidth / 2, top + chartHeight + 7, { align: "center" });
      if (scenario.year) { doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(71, 85, 105); doc.text(`${it ? "Anno" : "Year"} ${scenario.year}`, bx + barWidth / 2, top + chartHeight + 16, { align: "center" }); }
    });
    const legend = [[it ? "Costo operativo post-upgrade" : "Post-upgrade operating cost", [79, 183, 185]], [it ? "OPEX servizi" : "Service OPEX", [245, 158, 11]], [it ? "Pagamento contratto / investimento" : "Contract / investment payment", [148, 163, 184]], [it ? "Risparmio netto cliente" : "Customer net saving", [22, 163, 74]]];
    legend.forEach(([label, color], index) => {
      const lx = 18 + (index % 2) * 90, ly = 151 + Math.floor(index / 2) * 7;
      doc.setFillColor(...color); doc.rect(lx, ly - 3, 4, 4, "F");
      doc.setTextColor(71, 85, 105); doc.setFontSize(7); doc.text(label, lx + 6, ly);
    });
    if (result.cmsEnabled && postContract) {
      const boxY = 169;
      doc.setFillColor(248, 250, 252); doc.setDrawColor(220, 229, 232); doc.roundedRect(18, boxY, 174, 38, 2, 2, "FD");
      const comparison = [[it ? `Smart per ${result.serviceAgreementPeriod} anni` : `Smart for ${result.serviceAgreementPeriod} years`, money(result.contractedSavingsTotal), false], [it ? `Smart per tutti i ${result.analysisPeriod} anni` : `Smart for all ${result.analysisPeriod} years`, money(result.fullSmartSavingsTotal), false], [it ? "Risparmio lordo aggiuntivo" : "Additional gross saving", money(result.fullSmartAdditionalGrossSavings), true], [it ? "Effetto netto dopo i costi" : "Net effect after service costs", money(result.fullSmartIncrementalSavings), result.fullSmartIncrementalSavings >= 0]];
      comparison.forEach(([label, value], index) => {
        const cx = 24 + index * 42;
        doc.setTextColor(71, 85, 105); doc.setFontSize(6.2); doc.text(label, cx, boxY + 9, { maxWidth: 38 });
        const positiveValue = comparison[index][2];
        doc.setTextColor(positiveValue ? 21 : index === 3 ? 190 : 15, positiveValue ? 128 : index === 3 ? 18 : 23, positiveValue ? 61 : index === 3 ? 60 : 42); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(value, cx, boxY + 23);
      });
      doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105); doc.setFontSize(6.5);
      doc.text(result.powerAidEnabled ? (it ? "PowerAiD e il relativo fee sono inclusi solo quando generano un risparmio incrementale." : "PowerAiD and its fee are included only when they generate incremental savings.") : (it ? "PowerAiD non incluso nello scenario." : "PowerAiD is not included in the scenario."), 24, boxY + 33, { maxWidth: 160 });
    } else if (result.cmsEnabled) {
      doc.setFillColor(236, 253, 245); doc.setDrawColor(167, 243, 208); doc.roundedRect(42, 172, 126, 16, 2, 2, "FD");
      doc.setTextColor(4, 120, 87); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(it ? `Smart attivo per l'intero periodo di analisi - ${result.analysisPeriod} anni` : `Smart active throughout the full analysis period - ${result.analysisPeriod} years`, 105, 182, { align: "center" });
    }
  };

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("VIMALUX Intelligence", 14, 17);
  doc.setFontSize(14);
  doc.text(it ? "Studio Preliminare di FattibilitÃ  Economica" : "Preliminary Business Case", 14, 28);
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
    body: rows([[it ? "Cliente" : "Customer", project.customer.name], [it ? "Provincia" : "Province", project.customer.province], [it ? "Regione" : "Region", project.customer.region], [it ? "Contatto" : "Contact", project.customer.contact], ["Email", project.customer.email], [it ? "Telefono" : "Telephone", project.customer.telephone], [it ? "Progetto" : "Project", project.project.name], [it ? "Consulente" : "Consultant", project.project.consultant], [it ? "Data" : "Date", project.project.date]]),
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
      [it ? "QuantitÃ  LCU calcolata" : "Calculated LCU quantity", result.lcuQuantity],
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
    head: [[it ? "Tecnologia esistente" : "Existing technology", it ? "Potenza esistente" : "Existing wattage", it ? "QuantitÃ " : "Quantity", it ? "Nuovo prodotto LED" : "New LED product"]],
    body: replacementRows.map((row) => [row.technology, `${formatNumber(row.existingWattage, lang)} W`, formatNumber(row.quantity, lang), row.productName]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 8, valign: "middle" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "left" } },
    didParseCell: alignTableHeaders("left", "right", "right", "left"),
  });

  if (result.smartEnabled) {
    section(it ? "Hardware Smart Lighting" : "Smart Lighting hardware", doc.lastAutoTable.finalY + 9);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [[it ? "Componente" : "Component", it ? "QuantitÃ " : "Quantity", it ? "Prodotto" : "Product"]],
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
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.05 },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
  });

  section(it ? "Dettaglio CAPEX e OPEX" : "CAPEX and OPEX breakdown", doc.lastAutoTable.finalY + 9);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    margin: { bottom: 18 },
    head: [[it ? "Voce" : "Item", it ? "Importo" : "Amount"]],
    body: rows([[it ? "Apparecchi LED" : "LED luminaires", money(result.ledCapex)], ["LCU", money(result.smartHardwareCapex)], [it ? "Implementazione" : "Implementation", money(result.implementationCapex)], ["Gateway", money(result.gatewayCapex)], [it ? "Antenne" : "Antennas", money(result.antennaCapex)], [it ? "Contatori" : "Meters", money(result.meterCapex)], [it ? "Trasporto" : "Freight", money(result.freight)], [t("capex"), money(result.totalCapex)], ["CMS", money2(result.cmsOpex)], ["Gateway OPEX", money2(result.gatewayOpex)], ["PowerAiD fee", money2(result.powerAidFee)], [t("annualOpex"), money2(result.totalAnnualOpex)]]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { font: "helvetica", fontSize: 7.1, cellPadding: 0.9 },
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
  const disclaimer = it ? "Questa analisi rappresenta una valutazione preliminare basata su quantitÃ  aggregate, potenze medie e ipotesi commerciali. Le quantitÃ  definitive, il censimento GPS, la classificazione stradale, le verifiche UNI 11248, la progettazione illuminotecnica e l'assegnazione finale dei prodotti saranno sviluppati tramite VIMALUX Planner." : "This analysis is a preliminary assessment based on aggregated quantities, average wattages and commercial assumptions. Final quantities, the GPS census, road classification, UNI 11248 verification, photometric design and final product assignment will be developed through VIMALUX Planner.";
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
