import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, formatNumber, formatPercent, useT } from "./i18n.js";
import { aggregateReplacementRows } from "./reportSummary.js";

export function generateCustomerPdf(project, result) {
  const lang = project.language;
  const t = useT(lang);
  const it = lang === "it";
  const money = (value) => formatMoney(value, lang, project.project.currency);
  const percent = (value) => formatPercent(value, lang);
  const financed = project.assumptions.financingModel === "laas";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const section = (text, y) => {
    doc.setTextColor(15, 118, 110);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, 14, y);
    doc.setTextColor(15, 23, 42);
  };
  const rows = (items) => items.filter((item) => item && item[1] !== "" && item[1] != null).map(([label, value]) => [label, String(value)]);

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
  autoTable(doc, {
    startY: 57,
    theme: "grid",
    head: [[t("preliminary"), t("capex"), t("monthlyPayment"), t("annualOpex"), `${t("annualNet")}*`, paybackLabel]],
    body: [[result.decisionStatus.replace("_", "-"), money(result.totalCapex), money(result.monthlyPayment), money(result.totalAnnualOpex), money(result.customerAnnualNetBenefit), result.payback == null ? t("notAvailable") : `${formatNumber(result.payback, lang, 1)} ${t("years")}`]],
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 6.9, cellPadding: 1.8 },
  });
  doc.setFontSize(10);
  doc.text(t(result.decisionStatus), 14, doc.lastAutoTable.finalY + 8, { maxWidth: 182 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(it ? "* Beneficio netto annuo = beneficio lordo - OPEX annuo - pagamento annuo del finanziamento." : "* Annual net benefit = gross benefit - annual OPEX - annual financing payment.", 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
  doc.setTextColor(15, 23, 42);

  section(it ? "Cliente e progetto" : "Customer and project", doc.lastAutoTable.finalY + 28);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 33,
    theme: "plain",
    body: rows([[it ? "Cliente" : "Customer", project.customer.name], [it ? "Provincia" : "Province", project.customer.province], [it ? "Regione" : "Region", project.customer.region], [it ? "Contatto" : "Contact", project.customer.contact], ["Email", project.customer.email], [it ? "Telefono" : "Telephone", project.customer.telephone], [it ? "Progetto" : "Project", project.project.name], [it ? "Consulente" : "Consultant", project.project.consultant], [it ? "Data" : "Date", project.project.date]]),
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
    styles: { fontSize: 9, cellPadding: 1.4 },
  });

  section(it ? "Assunzioni principali" : "Key assumptions", doc.lastAutoTable.finalY + 8);
  const technology = [...new Set(project.groups.map((group) => group.technology))].join(", ");
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 13,
    theme: "striped",
    body: rows([
      [it ? "Numero apparecchi" : "Number of luminaires", formatNumber(result.totalQuantity, lang)],
      [it ? "Tecnologia esistente" : "Existing technology", technology],
      [it ? "Ore operative" : "Operating hours", formatNumber(project.assumptions.operatingHours, lang)],
      [it ? "Prezzo energia" : "Energy price", `${formatMoney(project.assumptions.energyPrice, lang, project.project.currency, 2)}/kWh`],
      [it ? "Periodo contrattuale" : "Contract period", `${project.assumptions.contractYears} ${t("years")}`],
      [it ? "Finanziamento" : "Financing", financed ? "Lighting as a Service" : (it ? "Acquisto diretto" : "Cash Purchase")],
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
    ]),
    styles: { fontSize: 7.3, cellPadding: 1.05 },
  });

  doc.addPage();
  section(it ? "Soluzione proposta" : "Proposed solution summary", 18);
  const replacementRows = aggregateReplacementRows(result.groupRows);
  autoTable(doc, {
    startY: 23,
    head: [[it ? "Tecnologia esistente" : "Existing technology", it ? "Potenza esistente" : "Existing wattage", it ? "Quantità" : "Quantity", it ? "Nuovo prodotto LED" : "New LED product"]],
    body: replacementRows.map((row) => [row.technology, `${formatNumber(row.existingWattage, lang)} W`, formatNumber(row.quantity, lang), row.productName]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8 },
  });

  if (result.smartEnabled) {
    section(it ? "Hardware Smart Lighting" : "Smart Lighting hardware", doc.lastAutoTable.finalY + 9);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [[it ? "Componente" : "Component", it ? "Quantità" : "Quantity", it ? "Prodotto" : "Product"]],
      body: [["LCU", formatNumber(result.lcuQuantity, lang), result.hardware.lcu.name || "-"], ["Gateway", formatNumber(result.hardware.gatewayQty, lang), result.hardware.gateway.name || "-"], ["Antenna", formatNumber(result.hardware.antennaQty, lang), result.hardware.antenna.name || "-"], [it ? "Contatore" : "Energy meter", formatNumber(result.hardware.meterQty, lang), result.hardware.meter.name || "-"]],
      headStyles: { fillColor: [15, 118, 110] },
      styles: { fontSize: 8 },
    });
  }

  section(it ? "Risultato energetico ed economico" : "Energy and economic result", doc.lastAutoTable.finalY + 9);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    theme: "striped",
    body: rows([[t("baseline"), `${formatNumber(result.baselineKwh, lang)} kWh`], [t("final"), `${formatNumber(result.finalKwh, lang)} kWh`], [t("energyReduction"), percent(result.energyReductionPercent)], [it ? "Riduzione CO2" : "CO2 reduction", `${formatNumber(result.co2ReductionKg / 1000, lang, 1)} ${it ? "t/anno" : "t/year"}`], [t("maintenanceSaving"), money(result.maintenanceSaving)], [t("annualOpex"), money(result.totalAnnualOpex)], [t("monthlyPayment"), money(result.monthlyPayment)], [it ? "Pagamento annuo" : "Annual payment", money(result.annualPayment)], [t("npv"), money(result.npv)], [`${t("lifecycle")} - ${result.analysisPeriod} ${t("years")}`, money(result.lifecycleResult)]]),
    styles: { fontSize: 7.5, cellPadding: 1.05 },
  });

  section(it ? "Dettaglio CAPEX e OPEX" : "CAPEX and OPEX breakdown", doc.lastAutoTable.finalY + 9);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 14,
    margin: { bottom: 18 },
    head: [[it ? "Voce" : "Item", it ? "Importo" : "Amount"]],
    body: rows([[it ? "Apparecchi LED" : "LED luminaires", money(result.ledCapex)], ["LCU", money(result.smartHardwareCapex)], [it ? "Implementazione" : "Implementation", money(result.implementationCapex)], ["Gateway", money(result.gatewayCapex)], [it ? "Antenne" : "Antennas", money(result.antennaCapex)], [it ? "Contatori" : "Meters", money(result.meterCapex)], [it ? "Trasporto" : "Freight", money(result.freight)], [t("capex"), money(result.totalCapex)], ["CMS", money(result.cmsOpex)], ["Gateway OPEX", money(result.gatewayOpex)], ["PowerAiD fee", money(result.powerAidFee)], [t("annualOpex"), money(result.totalAnnualOpex)]]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 7.1, cellPadding: 0.9 },
  });

  doc.addPage();
  section(it ? "Flusso di cassa cliente" : "Customer cash flow", 18);
  autoTable(doc, {
    startY: 23,
    margin: { bottom: 18 },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: [[it ? "Anno" : "Year", it ? "Beneficio lordo" : "Gross benefit", "OPEX", it ? "Pagamento" : "Payment", it ? "Flusso netto" : "Net cash flow", it ? "Cumulato" : "Cumulative"]],
    body: result.cashFlowRows.map((row) => [row.year, money(row.grossBenefit), money(row.opex), money(row.payment), money(row.netCashFlow), money(row.cumulative)]),
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 7.3, cellPadding: 1.5 },
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
    doc.text(`${it ? "Pagina" : "Page"} ${page} ${it ? "di" : "of"} ${pages}  |  v1.2`, 164, 286);
  }
  doc.save(`VIMALUX_${project.project.businessCaseId || "Business_Case"}.pdf`);
}
