import React from "react";
import { calculateAdditionalCosts } from "./additionalCosts.js";

const categories = [
  ["materiale", "Materiale"],
  ["lavoro", "Lavoro"],
  ["opere_civili", "Opere civili"],
  ["servizi", "Servizi"],
  ["altro", "Altro"],
];

const types = [
  ["capex", "CAPEX"],
  ["opex_annual", "OPEX annuale"],
];

const units = ["pz", "ore", "m", "m²", "forfait", "anno"];

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyRow = () => ({
  id: makeId(),
  description: "",
  category: "altro",
  costType: "capex",
  quantity: 1,
  unit: "pz",
  unitCost: 0,
  unitSalesPrice: 0,
  note: "",
});

const numberValue = (value) => {
  if (value === "") return "";
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export default function AdditionalCostsCard({ p, update }) {
  const it = p.language === "it";
  const rows = Array.isArray(p.additionalCosts) ? p.additionalCosts : [];
  const totals = calculateAdditionalCosts(rows);
  const formatter = new Intl.NumberFormat(it ? "it-IT" : "en-GB", {
    style: "currency",
    currency: p.project?.currency || "EUR",
    maximumFractionDigits: 2,
  });

  const replaceRows = (next) => update(["additionalCosts"], next);
  const change = (index, key, value) => {
    replaceRows(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };
  const remove = (index) => replaceRows(rows.filter((_, i) => i !== index));

  return (
    <section className="card additional-costs-card">
      <div className="card-title-row">
        <div>
          <h3>{it ? "Costi aggiuntivi di progetto" : "Additional project costs"}</h3>
          <p className="hint">
            {it
              ? "Costi specifici del progetto. Le voci CAPEX entrano nell'investimento; le voci OPEX annuali entrano nei costi/ricavi ricorrenti."
              : "Project-specific costs. CAPEX items are included in the investment; annual OPEX items are included in recurring costs/revenue."}
          </p>
        </div>
        <button type="button" className="primary" onClick={() => replaceRows([...rows, emptyRow()])}>
          {it ? "+ Aggiungi costo" : "+ Add cost"}
        </button>
      </div>

      {!rows.length ? (
        <p className="hint">
          {it
            ? "Nessun costo aggiuntivo inserito."
            : "No additional project costs entered."}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{it ? "Descrizione" : "Description"}</th>
                <th>{it ? "Categoria" : "Category"}</th>
                <th>{it ? "Tipo" : "Type"}</th>
                <th>{it ? "Quantità" : "Quantity"}</th>
                <th>{it ? "Unità" : "Unit"}</th>
                <th>{it ? "Costo unitario" : "Unit cost"}</th>
                <th>{it ? "Prezzo unitario" : "Unit sales price"}</th>
                <th>{it ? "Costo totale" : "Total cost"}</th>
                <th>{it ? "Prezzo totale" : "Total sales"}</th>
                <th>{it ? "Note" : "Notes"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const calculated = totals.rows[index] || {};
                return (
                  <tr key={row.id || index}>
                    <td>
                      <input
                        value={row.description || ""}
                        placeholder={it ? "Es. Nuovi pali" : "e.g. New poles"}
                        onChange={(e) => change(index, "description", e.target.value)}
                      />
                    </td>
                    <td>
                      <select value={row.category || "altro"} onChange={(e) => change(index, "category", e.target.value)}>
                        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={row.costType || "capex"} onChange={(e) => change(index, "costType", e.target.value)}>
                        {types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" step="any" value={row.quantity ?? 0} onChange={(e) => change(index, "quantity", numberValue(e.target.value))} />
                    </td>
                    <td>
                      <select value={row.unit || "pz"} onChange={(e) => change(index, "unit", e.target.value)}>
                        {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" step="any" value={row.unitCost ?? 0} onChange={(e) => change(index, "unitCost", numberValue(e.target.value))} />
                    </td>
                    <td>
                      <input type="number" min="0" step="any" value={row.unitSalesPrice ?? 0} onChange={(e) => change(index, "unitSalesPrice", numberValue(e.target.value))} />
                    </td>
                    <td>{formatter.format(calculated.costTotal || 0)}</td>
                    <td>{formatter.format(calculated.salesTotal || 0)}</td>
                    <td>
                      <input value={row.note || ""} onChange={(e) => change(index, "note", e.target.value)} />
                    </td>
                    <td>
                      <button type="button" className="danger secondary" onClick={() => remove(index)} aria-label={it ? "Elimina voce" : "Delete item"}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="additional-costs-summary">
        <span>CAPEX: <strong>{formatter.format(totals.capexSales)}</strong> ({it ? "costo" : "cost"} {formatter.format(totals.capexCost)})</span>
        <span>OPEX/{it ? "anno" : "year"}: <strong>{formatter.format(totals.annualOpexSales)}</strong> ({it ? "costo" : "cost"} {formatter.format(totals.annualOpexCost)})</span>
      </div>
    </section>
  );
}
