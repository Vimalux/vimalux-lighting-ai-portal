import React, { useMemo } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { groupProcurementBySupplier } from "./procurement.js";

const slug = (value) => String(value || "supplier").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "supplier";

function generateSupplierOrderPdf(group, p, it) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const currency = p.project?.currency || "EUR";
  const projectName = p.project?.name || p.name || "Project";
  const businessCase = p.project?.businessCaseId || p.project?.business_case_id || "";
  const locale = it ? "it-IT" : "en-GB";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quantity = new Intl.NumberFormat(locale, { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("VIMALUX", 15, 18);
  doc.setFontSize(14);
  doc.text(it ? "ORDINE FORNITORE - BOZZA" : "SUPPLIER ORDER - DRAFT", 15, 29);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${it ? "Fornitore" : "Supplier"}: ${group.supplier}`, 15, 39);
  doc.text(`${it ? "Progetto" : "Project"}: ${projectName}`, 15, 45);
  if (businessCase) doc.text(`Business Case: ${businessCase}`, 15, 51);
  doc.text(`${it ? "Data" : "Date"}: ${date}`, 145, 39);

  autoTable(doc, {
    startY: businessCase ? 59 : 53,
    head: [[
      it ? "Prodotto / lavoro" : "Product / work",
      "SKU",
      it ? "Quantità" : "Qty",
      it ? "Unità" : "Unit",
      it ? "Costo unitario" : "Unit price",
      it ? "Totale" : "Total",
    ]],
    body: group.items.map((item) => [
      item.description,
      item.supplierSku || "-",
      quantity.format(item.quantity),
      item.unit || "pz",
      money.format(item.unitCost),
      money.format(item.totalCost),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    headStyles: { fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 28 },
      2: { halign: "right", cellWidth: 18 },
      3: { cellWidth: 16 },
      4: { halign: "right", cellWidth: 30 },
      5: { halign: "right", cellWidth: 30 },
    },
  });

  const y = (doc.lastAutoTable?.finalY || 80) + 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${it ? "Totale netto" : "Net total"}: ${money.format(group.totalCost)}`, 195, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    it
      ? "Bozza interna VIMALUX. L'ordine diventa vincolante solo dopo conferma finale e invio autorizzato da VIMALUX."
      : "Internal VIMALUX draft. The order becomes binding only after final confirmation and authorized issue by VIMALUX.",
    15,
    y + 12,
    { maxWidth: 180 },
  );

  doc.save(`${slug(projectName)}-${slug(group.supplier)}-${it ? "ordine" : "supplier-order"}.pdf`);
}

class ProcurementErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Procurement preview failed", error);
  }
  render() {
    if (this.state.failed) {
      return <section className="card" style={{ marginTop: 20 }}><p className="hint">Procurement preview unavailable. Existing project data is unaffected.</p></section>;
    }
    return this.props.children;
  }
}

function ProcurementPanelContent({ p }) {
  const it = p.language === "it";
  const groups = useMemo(() => groupProcurementBySupplier(p), [p]);
  const currency = p.project?.currency || "EUR";
  const locale = it ? "it-IT" : "en-GB";
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 });
  const quantity = new Intl.NumberFormat(locale, { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="catalogue-title-row">
      <div>
        <h2>{it ? "Procurement / Ordini fornitori" : "Procurement / Supplier orders"}</h2>
        <p className="hint">{it
          ? "Anteprima interna generata dai prodotti selezionati. Il fornitore deriva dal catalogo master. Per ogni fornitore può essere generata una bozza d'ordine PDF; nessun ordine viene inviato automaticamente."
          : "Internal preview generated from selected products. Supplier comes from the master catalogue. A draft PDF order can be generated for each supplier; no order is sent automatically."}</p>
      </div>
    </div>
    {!groups.length ? <p className="hint">{it ? "Nessuna voce di acquisto rilevata nel progetto attivo." : "No procurement items detected in the active project."}</p> : groups.map((group) => <div key={group.supplier} style={{ border: "1px solid var(--border, #d8e0ea)", borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div><strong>{group.supplier}</strong><div className="hint">{quantity.format(group.items.length)} {it ? "voci" : "items"} · {money.format(group.totalCost)}</div></div>
        {group.assigned && <button type="button" className="secondary" onClick={() => generateSupplierOrderPdf(group, p, it)}>{it ? "Genera ordine PDF" : "Generate PDF order"}</button>}
      </div>
      <div className="table-scroll"><table><thead><tr>
        <th>{it ? "Fonte" : "Source"}</th><th>Brand</th><th>{it ? "Prodotto / lavoro" : "Product / work"}</th><th>SKU</th><th>{it ? "Quantità" : "Quantity"}</th><th>{it ? "Unità" : "Unit"}</th><th>{it ? "Costo unitario" : "Unit cost"}</th><th>{it ? "Totale" : "Total"}</th><th>{it ? "Fornitore" : "Supplier"}</th>
      </tr></thead><tbody>{group.items.map((item) => <tr key={item.key}>
        <td>{item.source}</td><td>{item.brand || "—"}</td><td>{item.description}</td><td>{item.supplierSku || "—"}</td><td>{quantity.format(item.quantity)}</td><td>{item.unit}</td><td>{money.format(item.unitCost)}</td><td>{money.format(item.totalCost)}</td><td>{item.supplier || (it ? "Non assegnato" : "Unassigned")}</td>
      </tr>)}</tbody></table></div>
    </div>)}
  </section>;
}

export default function ProcurementPanel({ p }) {
  return <ProcurementErrorBoundary><ProcurementPanelContent p={p} /></ProcurementErrorBoundary>;
}
