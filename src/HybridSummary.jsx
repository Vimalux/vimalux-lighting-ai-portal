import React, { useMemo } from "react";
import { calculateHybridSolar } from "./hybridSolar.js";

const localeFor = (language) => language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";

export default function HybridSummary({ p, update }) {
  const it = p.language === "it";
  const locale = localeFor(p.language);
  const summary = useMemo(() => calculateHybridSolar(p), [p]);
  if (!summary.enabled) return null;

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: p.project?.currency || "EUR", maximumFractionDigits: 0 });
  const yieldValue = p.assumptions?.hybridSolarYieldKwhPerKwp || 0;
  const statusLabel = (status) => status === "fail"
    ? (it ? ">18 kg · NON OK" : ">18 kg · NOT OK")
    : status === "warning"
      ? (it ? "18 kg · verifica palo" : "18 kg · pole check")
      : status === "ok" ? "OK" : "—";

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="catalogue-title-row">
      <div>
        <h2>{it ? "Hybrid Solar Preview" : "Hybrid Solar Preview"}</h2>
        <p className="hint">{it
          ? "Modulo separato: non modifica il Business Case LED esistente. La resa solare del progetto sarà in seguito alimentata automaticamente da coordinate/mappa."
          : "Separate module: it does not change the existing LED Business Case. Project solar yield can later be populated automatically from coordinates/map."}</p>
      </div>
    </div>

    <div className="form-grid" style={{ marginBottom: 16 }}>
      <label><span>{it ? "Resa solare progetto (kWh/kWp/anno)" : "Project solar yield (kWh/kWp/year)"}</span>
        <input inputMode="decimal" value={yieldValue || ""} placeholder="e.g. 1350" onChange={(e) => update(["assumptions", "hybridSolarYieldKwhPerKwp"], Number(String(e.target.value).replace(",", ".")) || 0)} />
      </label>
    </div>

    <div className="kpis">
      <div className="kpi"><span>{it ? "Unità ibride" : "Hybrid units"}</span><strong>{number.format(summary.totalHybridUnits)}</strong></div>
      <div className="kpi"><span>{it ? "Produzione PV annua" : "Annual PV production"}</span><strong>{summary.solarYieldKwhPerKwp ? `${number.format(summary.totalPvKwh)} kWh` : "—"}</strong></div>
      <div className="kpi"><span>{it ? "Solare utilizzabile" : "Usable solar"}</span><strong>{summary.solarYieldKwhPerKwp ? `${number.format(summary.totalUsableSolarKwh)} kWh` : "—"}</strong></div>
      <div className="kpi"><span>{it ? "Riduzione costo rete" : "Grid cost reduction"}</span><strong>{summary.solarYieldKwhPerKwp ? money.format(summary.totalGridSavingEur) : "—"}</strong></div>
    </div>

    {!summary.solarYieldKwhPerKwp && <p className="hint">{it ? "Inserire la resa solare locale per attivare il calcolo energetico. I dati fisici di pannello, batteria e peso sono già validati." : "Enter the local solar yield to activate the energy calculation. Panel, battery and weight data are already validated."}</p>}

    <div className="table-scroll"><table><thead><tr>
      <th>{it ? "Prodotto" : "Product"}</th><th>{it ? "Qtà" : "Qty"}</th><th>PV Wp</th><th>{it ? "Batteria" : "Battery"}</th><th>{it ? "Modo solare" : "Solar mode"}</th><th>{it ? "Peso" : "Weight"}</th><th>{it ? "Controllo peso" : "Weight check"}</th><th>{it ? "PV annuo" : "Annual PV"}</th><th>{it ? "Solare utile" : "Usable solar"}</th>
    </tr></thead><tbody>{summary.rows.map((row) => <tr key={`${row.groupId}-${row.productId}`}>
      <td>{row.productName}</td><td>{number.format(row.quantity)}</td><td>{number.format(row.pvWp)} Wp</td><td>{number.format(row.batteryWh)} Wh</td><td>{number.format(row.solarModeW)} W</td><td>{row.weightKg ? `${number.format(row.weightKg)} kg` : "—"}</td><td><strong>{statusLabel(row.weightStatus)}</strong></td><td>{summary.solarYieldKwhPerKwp ? `${number.format(row.annualPvKwh)} kWh` : "—"}</td><td>{summary.solarYieldKwhPerKwp ? `${number.format(row.usableSolarKwh)} kWh` : "—"}</td>
    </tr>)}</tbody></table></div>
  </section>;
}
