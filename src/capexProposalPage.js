import autoTable from "jspdf-autotable";
import { calculateBusinessCase } from "./calculations.js";
import { applyWarrantyPricing } from "./warranty.js";
import { buildCustomerCapexDetail } from "./customerCapexDetail.js";
import { alignedTable, reportMoney, reportNumber } from "./reportPresentation.js";

const money = reportMoney;
const number = reportNumber;

function tableRow(row, lang) {
  return [
    row.name,
    number(row.quantity, Number.isInteger(row.quantity) ? 0 : 2, lang),
    row.unit || "",
    money(row.unitPrice, lang),
    money(row.total, lang),
  ];
}

export function appendCapexProposalPage(doc, project, options = {}) {
  const lang = options.lang === "it" ? "it" : "en";
  const it = lang === "it";
  const teal = options.teal || [15, 118, 110];
  const navy = options.navy || [15, 23, 42];
  const muted = options.muted || [71, 85, 105];
  const light = options.light || [248, 250, 252];
  const calculated = calculateBusinessCase(applyWarrantyPricing(project));
  const detail = buildCustomerCapexDetail(project, calculated);
  if (!detail.luminaires.length && !detail.components.length) return calculated;

  const section = (title, y) => {
    doc.setTextColor(...teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, y);
    doc.setTextColor(...navy);
  };

  doc.addPage();
  section(it ? "Apparecchi proposti e dettaglio CAPEX" : "Proposed luminaires and CAPEX detail", 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...muted);
  doc.text(it
    ? "Il dettaglio riporta esclusivamente quantità e prezzi di vendita inclusi nel Business Case. Costi interni, margini e prezzi di acquisto non sono mostrati."
    : "This detail shows only quantities and customer sales prices included in the Business Case. Internal costs, margins and purchase prices are not shown.", 14, 28, { maxWidth: 182 });

  const standardQty = Math.max(0, detail.totalLuminaireQuantity - detail.hybridLuminaireQuantity);
  const hasHybrid = detail.hybridLuminaireQuantity > 0;
  const luminaireSummary = it
    ? hasHybrid
      ? `${number(detail.totalLuminaireQuantity, 0, lang)} apparecchi: ${number(standardQty, 0, lang)} LED standard + ${number(detail.hybridLuminaireQuantity, 0, lang)} Hybrid`
      : `${number(detail.totalLuminaireQuantity, 0, lang)} apparecchi LED standard`
    : hasHybrid
      ? `${number(detail.totalLuminaireQuantity, 0, lang)} luminaires: ${number(standardQty, 0, lang)} standard LED + ${number(detail.hybridLuminaireQuantity, 0, lang)} Hybrid`
      : `${number(detail.totalLuminaireQuantity, 0, lang)} standard LED luminaires`;
  const luminaireSectionTitle = it
    ? (hasHybrid ? "Apparecchi LED / Hybrid" : "Apparecchi LED")
    : (hasHybrid ? "LED / Hybrid luminaires" : "LED luminaires");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...navy);
  doc.text(luminaireSummary, 14, 37);

  section(luminaireSectionTitle, 48);
  autoTable(doc, {
    startY: 53,
    theme: "grid",
    head: [[it ? "Prodotto / modello" : "Product / model", it ? "Tipo" : "Type", "W", it ? "Quantità" : "Quantity", it ? "Prezzo unitario" : "Unit price", it ? "Importo" : "Amount"]],
    body: [
      ...detail.luminaires.map((row) => [row.name, row.type, number(row.wattage, 0, lang), number(row.quantity, 0, lang), money(row.unitPrice, lang), money(row.total, lang)]),
      [it ? "Subtotale apparecchi" : "Luminaire subtotal", "", "", number(detail.totalLuminaireQuantity, 0, lang), "", money(detail.luminaireSubtotal, lang)],
    ],
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7.1, cellPadding: 1.2, overflow: "linebreak" },
    columnStyles: { 0: { halign: "left", cellWidth: 66 }, 1: { halign: "left", cellWidth: 18 }, 2: { halign: "right", cellWidth: 15 }, 3: { halign: "right", cellWidth: 20 }, 4: { halign: "right", cellWidth: 31 }, 5: { halign: "right", cellWidth: 32 } },
    didParseCell(data) {
      alignedTable({ 0: "left", 1: "left", 2: "right", 3: "right", 4: "right", 5: "right" }).didParseCell(data);
      if (data.section === "body" && data.row.index === detail.luminaires.length) data.cell.styles.fontStyle = "bold";
    },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  let y = doc.lastAutoTable.finalY + 10;
  if (y > 205) {
    doc.addPage();
    y = 20;
  }
  section(it ? "Smart Lighting, logistica e altri CAPEX" : "Smart Lighting, logistics and other CAPEX", y);
  const componentBody = detail.components.map((row) => tableRow(row, lang));
  componentBody.push([it ? "Subtotale altri CAPEX" : "Other CAPEX subtotal", "", "", "", money(detail.componentSubtotal, lang)]);
  componentBody.push([it ? "CAPEX totale" : "Total CAPEX", "", "", "", money(detail.totalCapex, lang)]);
  autoTable(doc, {
    startY: y + 5,
    theme: "grid",
    head: [[it ? "Voce" : "Item", it ? "Quantità" : "Quantity", it ? "Unità" : "Unit", it ? "Prezzo unitario" : "Unit price", it ? "Importo" : "Amount"]],
    body: componentBody,
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7, cellPadding: 1.05, overflow: "linebreak" },
    columnStyles: { 0: { halign: "left", cellWidth: 80 }, 1: { halign: "right", cellWidth: 22 }, 2: { halign: "left", cellWidth: 18 }, 3: { halign: "right", cellWidth: 30 }, 4: { halign: "right", cellWidth: 32 } },
    didParseCell(data) {
      alignedTable({ 0: "left", 1: "right", 2: "left", 3: "right", 4: "right" }).didParseCell(data);
      if (data.section === "body" && data.row.index >= componentBody.length - 2) data.cell.styles.fontStyle = "bold";
      const source = detail.components[data.row.index];
      if (data.section === "body" && source?.category === "adjustment") data.cell.styles.textColor = source.total < 0 ? [4, 120, 87] : [180, 83, 9];
    },
    margin: { left: 14, right: 14, bottom: 22 },
  });

  const noteY = Math.min(269, doc.lastAutoTable.finalY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...muted);
  doc.text(detail.reconciles
    ? (it ? `Verifica CAPEX: dettaglio riconciliato al totale Business Case di ${money(detail.totalCapex, lang)}.` : `CAPEX check: itemized detail reconciles to the Business Case total of ${money(detail.totalCapex, lang)}.`)
    : (it ? "Attenzione: il dettaglio CAPEX non riconcilia al totale Business Case." : "Warning: CAPEX detail does not reconcile to the Business Case total."), 14, noteY, { maxWidth: 182 });

  return calculated;
}
