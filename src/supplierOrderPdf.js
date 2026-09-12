import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : autoTableModule.default;
import { partnerDisplayText } from "./partnerRoles.js";

const slug = (value) => String(value || "supplier").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "supplier";

export function createSupplierOrderPdf(group, p, it) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const projectName = p.project?.name || p.name || "Project";
  const businessCase = p.project?.businessCaseId || p.project?.business_case_id || "";
  const locale = it ? "it-IT" : "en-GB";
  const quantity = new Intl.NumberFormat(locale, { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("VIMALUX", 15, 18);
  doc.setFontSize(14);
  doc.text(it ? "RICHIESTA DI OFFERTA E FORNITURA" : "PARTNER ORDER LIST", 15, 29);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${it ? "Fornitore / Partner" : "Supplier / Partner"}: ${group.supplier}`, 15, 39);
  doc.text(`${it ? "Progetto" : "Project"}: ${projectName}`, 15, 45);
  if (businessCase) doc.text(`Business Case: ${businessCase}`, 15, 51);
  doc.text(`${it ? "Data" : "Date"}: ${date}`, 145, 39);

  autoTable(doc, {
    startY: businessCase ? 59 : 53,
    margin: { left: 15, right: 15 },
    head: [[
      it ? "Prodotto / lavoro" : "Product / work",
      "SKU",
      it ? "Quantità" : "Qty",
      it ? "Unità" : "Unit",
    ]],
    body: group.items.map((item) => [
      partnerDisplayText(item.description),
      item.supplierSku || "-",
      quantity.format(item.quantity),
      item.unit || "pz",
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    headStyles: { fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 96 },
      1: { cellWidth: 36 },
      2: { halign: "right", cellWidth: 24 },
      3: { cellWidth: 24 },
    },
  });

  const y = (doc.lastAutoTable?.finalY || 80) + 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    it
      ? "Documento destinato al partner per confermare quantità, specifiche e disponibilità. Prezzi, condizioni di pagamento, resa e condizioni commerciali saranno concordati separatamente prima dell'emissione dell'ordine di acquisto definitivo VIMALUX."
      : "Document for the partner to confirm quantities, specifications and availability. Prices, payment terms, delivery terms and other commercial conditions will be agreed separately before VIMALUX issues the final Purchase Order.",
    15,
    y,
    { maxWidth: 180 },
  );

  return doc;
}

export function generateSupplierOrderPdf(group, p, it) {
  const doc = createSupplierOrderPdf(group,p,it);
  doc.save(`${slug(p.project?.name || p.name)}-${slug(group.supplier)}-${it ? "richiesta-offerta-fornitura" : "partner-order-list"}.pdf`);
}
