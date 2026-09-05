import React, { useEffect, useMemo, useState } from "react";
import { calculateHybridSolar } from "./hybridSolar.js";
import { resolveMunicipalitySolar, stripMunicipalityPrefix } from "./solarLocation.js";

const localeFor = (language) => language === "da" ? "da-DK" : language === "en" ? "en-GB" : "it-IT";
const monthLabels = {
  it: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  da: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"],
};

export default function HybridSummary({ p, update }) {
  const it = p.language === "it";
  const locale = localeFor(p.language);
  const summary = useMemo(() => calculateHybridSolar(p), [p]);
  const storedLocation = p.assumptions?.hybridSolarLocation || {};
  const defaultMunicipality = storedLocation.query || stripMunicipalityPrefix(p.customer?.name || "");
  const [municipality, setMunicipality] = useState(defaultMunicipality);
  const [loadingSolar, setLoadingSolar] = useState(false);
  const [solarError, setSolarError] = useState("");

  useEffect(() => {
    if (storedLocation.query && storedLocation.query !== municipality) setMunicipality(storedLocation.query);
  }, [storedLocation.query]);

  if (!summary.enabled) return null;

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: p.project?.currency || "EUR", maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const yieldValue = summary.solarYieldKwhPerKwp || 0;
  const months = monthLabels[p.language] || monthLabels.it;
  const statusLabel = (status) => status === "fail"
    ? (it ? ">18 kg · NON OK" : ">18 kg · NOT OK")
    : status === "warning"
      ? (it ? "18 kg · verifica palo" : "18 kg · pole check")
      : status === "ok" ? "OK" : "—";

  const calculateMunicipality = async () => {
    setLoadingSolar(true);
    setSolarError("");
    try {
      const location = await resolveMunicipalitySolar(municipality, {
        countryCode: String(p.customer?.country || "Italia").toLowerCase().includes("ital") ? "IT" : "",
        language: p.language || "it",
      });
      update(["assumptions", "hybridSolarLocation"], location);
      update(["assumptions", "hybridSolarYieldKwhPerKwp"], location.annualYieldKwhPerKwp);
    } catch (error) {
      setSolarError(error?.message || String(error));
    } finally {
      setLoadingSolar(false);
    }
  };

  return <section className="card" style={{ marginTop: 20 }}>
    <div className="catalogue-title-row">
      <div>
        <h2>Hybrid Solar Preview</h2>
        <p className="hint">{it
          ? "Stima separata per apparecchi ibridi. Il calcolo da Comune usa il centro geografico del Comune e un profilo solare mensile; non modifica ancora il Business Case LED esistente."
          : "Separate hybrid-luminaire estimate. Municipality mode uses the municipality centre and a monthly solar profile; it does not yet change the existing LED Business Case."}</p>
      </div>
    </div>

    <div className="form-grid" style={{ marginBottom: 16 }}>
      <label><span>{it ? "Comune" : "Municipality"}</span>
        <input value={municipality} placeholder={it ? "es. Poggiardo" : "e.g. Poggiardo"} onChange={(e) => setMunicipality(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && municipality.trim()) calculateMunicipality(); }} />
      </label>
      <label><span>{it ? "Calcolo locale" : "Local calculation"}</span>
        <button type="button" className="primary" disabled={loadingSolar || !municipality.trim()} onClick={calculateMunicipality}>{loadingSolar ? (it ? "Calcolo..." : "Calculating...") : (it ? "Calcola da Comune" : "Calculate from municipality")}</button>
      </label>
      <label><span>{it ? "Resa solare annua (kWh/kWp)" : "Annual solar yield (kWh/kWp)"}</span>
        {summary.hasMonthlyProfile
          ? <input readOnly value={number.format(yieldValue)} />
          : <input inputMode="decimal" value={p.assumptions?.hybridSolarYieldKwhPerKwp || ""} placeholder="e.g. 1350" onChange={(e) => update(["assumptions", "hybridSolarYieldKwhPerKwp"], Number(String(e.target.value).replace(",", ".")) || 0)} />}
      </label>
    </div>

    {solarError && <p className="hint" style={{ color: "#b42318" }}>{solarError} {it ? "È ancora possibile usare la resa annua manuale." : "You can still use the manual annual yield."}</p>}
    {summary.hasMonthlyProfile && <p className="hint"><strong>{it ? "Livello dati" : "Data level"}:</strong> {it ? "Stima comunale" : "Municipality estimate"} · {summary.location?.resolvedName}{summary.location?.admin1 ? `, ${summary.location.admin1}` : ""} · {number.format(summary.location?.latitude)}°, {number.format(summary.location?.longitude)}° · {summary.location?.solarSource || "PVGIS"} · {it ? "piano orizzontale" : "horizontal plane"}.</p>}

    <div className="kpis">
      <div className="kpi"><span>{it ? "Unità ibride" : "Hybrid units"}</span><strong>{number.format(summary.totalHybridUnits)}</strong></div>
      <div className="kpi"><span>{it ? "Produzione PV annua" : "Annual PV production"}</span><strong>{yieldValue ? `${number.format(summary.totalPvKwh)} kWh` : "—"}</strong></div>
      <div className="kpi"><span>{it ? "Solare utilizzabile" : "Usable solar"}</span><strong>{yieldValue ? `${number.format(summary.totalUsableSolarKwh)} kWh` : "—"}</strong></div>
      <div className="kpi"><span>{it ? "Contributo solare annuo" : "Annual solar contribution"}</span><strong>{yieldValue ? `${percent.format(summary.totalContributionPercent)}%` : "—"}</strong></div>
      <div className="kpi"><span>{it ? "Riduzione costo rete" : "Grid cost reduction"}</span><strong>{yieldValue ? money.format(summary.totalGridSavingEur) : "—"}</strong></div>
    </div>

    {!yieldValue && <p className="hint">{it ? "Calcolare dal Comune oppure inserire una resa solare annua manuale. I dati fisici di pannello, batteria e peso sono già validati." : "Calculate from municipality or enter a manual annual solar yield. Panel, battery and weight data are already validated."}</p>}

    {summary.hasMonthlyProfile && <div className="table-scroll" style={{ marginTop: 16 }}><table><thead><tr>
      <th>{it ? "Mese" : "Month"}</th><th>{it ? "Resa locale" : "Local yield"}</th><th>{it ? "Produzione PV" : "PV production"}</th><th>{it ? "Solare utile" : "Usable solar"}</th><th>{it ? "Carico ibrido" : "Hybrid load"}</th><th>{it ? "Contributo solare" : "Solar contribution"}</th><th>{it ? "Risparmio rete" : "Grid saving"}</th>
    </tr></thead><tbody>{summary.monthlyTotals.map((row, index) => <tr key={row.month}>
      <td>{months[index]}</td><td>{number.format(row.yieldKwhPerKwp)} kWh/kWp</td><td>{number.format(row.pvKwh)} kWh</td><td>{number.format(row.usableSolarKwh)} kWh</td><td>{number.format(row.loadKwh)} kWh</td><td><strong>{percent.format(row.contributionPercent)}%</strong></td><td>{money.format(row.gridSavingEur)}</td>
    </tr>)}</tbody></table></div>}

    <div className="table-scroll" style={{ marginTop: 16 }}><table><thead><tr>
      <th>{it ? "Prodotto" : "Product"}</th><th>{it ? "Qtà" : "Qty"}</th><th>PV Wp</th><th>{it ? "Batteria" : "Battery"}</th><th>{it ? "Modo solare" : "Solar mode"}</th><th>{it ? "Autonomia" : "Autonomy"}</th><th>{it ? "Peso" : "Weight"}</th><th>{it ? "Controllo peso" : "Weight check"}</th><th>{it ? "PV annuo" : "Annual PV"}</th><th>{it ? "Solare utile" : "Usable solar"}</th><th>{it ? "Contributo" : "Contribution"}</th>
    </tr></thead><tbody>{summary.rows.map((row) => <tr key={`${row.groupId}-${row.productId}`}>
      <td>{row.productName}</td><td>{number.format(row.quantity)}</td><td>{number.format(row.pvWp)} Wp</td><td>{number.format(row.batteryWh)} Wh</td><td>{number.format(row.solarModeW)} W</td><td>{row.batteryAutonomyHours ? `${number.format(row.batteryAutonomyHours)} h` : "—"}</td><td>{row.weightKg ? `${number.format(row.weightKg)} kg` : "—"}</td><td><strong>{statusLabel(row.weightStatus)}</strong></td><td>{yieldValue ? `${number.format(row.annualPvKwh)} kWh` : "—"}</td><td>{yieldValue ? `${number.format(row.usableSolarKwh)} kWh` : "—"}</td><td>{yieldValue ? `${percent.format(row.annualContributionPercent)}%` : "—"}</td>
    </tr>)}</tbody></table></div>
  </section>;
}
