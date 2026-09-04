import React, { useMemo } from "react";
import { groupProcurementBySupplier, procurementCsv } from "./procurement.js";

const slug = (value) => String(value || "supplier").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "supplier";

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
  const money = new Intl.NumberFormat(it ? "it-IT" : "en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  const projectName = p.project?.name || p.name || "Project";

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="catalogue-title-row">
      <div>
        <h2>{it ? "Procurement / Ordini fornitori" : "Procurement / Supplier orders"}</h2>
        <p className="hint">{it
          ? "Anteprima interna generata dai prodotti selezionati. Il fornitore deriva dal catalogo master e non viene ridefinito per singolo progetto. Nessun ordine viene inviato automaticamente."
          : "Internal preview generated from selected products. Supplier comes from the master catalogue and is not redefined per project. No order is sent automatically."}</p>
      </div>
    </div>
    {!groups.length ? <p className="hint">{it ? "Nessuna voce di acquisto rilevata nel progetto attivo." : "No procurement items detected in the active project."}</p> : groups.map((group) => <div key={group.supplier} style={{ border: "1px solid var(--border, #d8e0ea)", borderRadius: 10, padding: 14, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <div><strong>{group.supplier}</strong><div className="hint">{group.items.length} {it ? "voci" : "items"} · {money.format(group.totalCost)}</div></div>
        {group.assigned && <button type="button" className="secondary" onClick={() => downloadText(`${slug(projectName)}-${slug(group.supplier)}-procurement.csv`, procurementCsv(group, p))}>{it ? "Esporta CSV" : "Export CSV"}</button>}
      </div>
      <div className="table-scroll"><table><thead><tr>
        <th>{it ? "Fonte" : "Source"}</th><th>Brand</th><th>{it ? "Prodotto / lavoro" : "Product / work"}</th><th>SKU</th><th>{it ? "Quantità" : "Quantity"}</th><th>{it ? "Unità" : "Unit"}</th><th>{it ? "Costo unitario" : "Unit cost"}</th><th>{it ? "Totale" : "Total"}</th><th>{it ? "Fornitore" : "Supplier"}</th>
      </tr></thead><tbody>{group.items.map((item) => <tr key={item.key}>
        <td>{item.source}</td><td>{item.brand || "—"}</td><td>{item.description}</td><td>{item.supplierSku || "—"}</td><td>{item.quantity}</td><td>{item.unit}</td><td>{money.format(item.unitCost)}</td><td>{money.format(item.totalCost)}</td><td>{item.supplier || (it ? "Non assegnato" : "Unassigned")}</td>
      </tr>)}</tbody></table></div>
    </div>)}
  </section>;
}

export default function ProcurementPanel({ p }) {
  return <ProcurementErrorBoundary><ProcurementPanelContent p={p} /></ProcurementErrorBoundary>;
}
