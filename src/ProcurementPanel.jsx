import React, { useMemo } from "react";
import { generateSupplierOrderPdf } from "./supplierOrderPdf.js";
import { groupProcurementBySupplier } from "./procurement.js";

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
          ? "Anteprima interna generata dai prodotti selezionati. Costi e totali restano visibili solo internamente. Per ogni fornitore può essere generata una Richiesta di Offerta e Fornitura senza prezzi; nessun ordine viene inviato automaticamente."
          : "Internal preview generated from selected products. Costs and totals remain visible internally only. A price-free Partner Order List can be generated for each supplier; no order is sent automatically."}</p>
      </div>
    </div>
    {!groups.length ? <p className="hint">{it ? "Nessuna voce di acquisto rilevata nel progetto attivo." : "No procurement items detected in the active project."}</p> : groups.map((group) => <div key={group.supplier} style={{ border: "1px solid var(--border, #d8e0ea)", borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div><strong>{group.supplier}</strong><div className="hint">{quantity.format(group.items.length)} {it ? "voci" : "items"} · {money.format(group.totalCost)} <span style={{ opacity: .72 }}>{it ? "(solo interno)" : "(internal only)"}</span></div></div>
        {group.assigned && <button type="button" className="secondary" onClick={() => generateSupplierOrderPdf(group, p, it)}>{it ? "Genera lista partner PDF" : "Generate Partner Order List"}</button>}
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
