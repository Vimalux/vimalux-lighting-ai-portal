import React from "react";
import { calculateVatSummary } from "./vat.js";
import { formatMoney, formatNumber } from "./i18n.js";

const Numeric = ({ value, onChange }) => <input inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;

export default function VatSettings({ p, r, update }) {
  const it = p.language === "it";
  const a = p.assumptions || {};
  const summary = calculateVatSummary(p, r);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  return <section className="card">
    <h2>{it ? "IVA e cash-flow del Comune" : "VAT & municipality cash-flow"}</h2>
    <p className="hint">{it ? "I valori commerciali VIMALUX restano al netto IVA. Questa sezione calcola separatamente l'IVA non recuperabile e il cash-out effettivo del Comune." : "VIMALUX commercial values remain net of VAT. This section separately calculates unrecoverable VAT and the municipality's effective cash-out."}</p>
    <div className="form-grid">
      <label><span>{it ? "Detraibilità IVA" : "VAT recoverability"}</span><select value={a.vatRecoverability || "non_deductible"} onChange={(e) => update(["assumptions","vatRecoverability"], e.target.value)}><option value="non_deductible">{it ? "Non detraibile" : "Non-deductible"}</option><option value="deductible">{it ? "Detraibile" : "Deductible"}</option><option value="partial">{it ? "Parzialmente detraibile" : "Partially deductible"}</option></select></label>
      {a.vatRecoverability === "partial" && <label><span>{it ? "% IVA recuperabile" : "% recoverable VAT"}</span><Numeric value={a.vatRecoverablePercent ?? 0} onChange={(v) => update(["assumptions","vatRecoverablePercent"], v)} /></label>}
      <label><span>{it ? "IVA hardware / retrofit %" : "Hardware / retrofit VAT %"}</span><Numeric value={a.vatHardwarePercent ?? 22} onChange={(v) => update(["assumptions","vatHardwarePercent"], v)} /></label>
      <label><span>{it ? "IVA software / servizi digitali %" : "Software / digital services VAT %"}</span><Numeric value={a.vatDigitalPercent ?? 22} onChange={(v) => update(["assumptions","vatDigitalPercent"], v)} /></label>
      <label><span>{it ? "IVA manutenzione %" : "Maintenance VAT %"}</span><Numeric value={a.vatMaintenancePercent ?? 22} onChange={(v) => update(["assumptions","vatMaintenancePercent"], v)} /></label>
      <label><span>{it ? "IVA opere strutturali qualificate %" : "Qualified structural works VAT %"}</span><Numeric value={a.vatStructuralPercent ?? 10} onChange={(v) => update(["assumptions","vatStructuralPercent"], v)} /></label>
    </div>
    <div className="breakdown">
      <div><span>{it ? "CAPEX netto VIMALUX" : "VIMALUX net CAPEX"}</span><span></span><strong>{money(summary.capexNet)}</strong></div>
      <div><span>{it ? "IVA CAPEX non recuperabile" : "Unrecoverable CAPEX VAT"}</span><span></span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div><span>{it ? "Cash-out CAPEX Comune" : "Municipality CAPEX cash-out"}</span><span></span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div><span>{it ? "OPEX annuo netto" : "Net annual OPEX"}</span><span></span><strong>{money(summary.annualOpexNet)}</strong></div>
      <div><span>{it ? "IVA OPEX annua non recuperabile" : "Unrecoverable annual OPEX VAT"}</span><span></span><strong>{money(summary.unrecoverableAnnualOpexVat)}</strong></div>
      <div><span>{it ? "Cash-out annuo Comune" : "Municipality annual cash-out"}</span><span></span><strong>{money(summary.municipalityAnnualOpexCash)}</strong></div>
    </div>
    <p className="hint">{it ? "Le opere civili sono trattate al tasso strutturale solo quando inserite come Additional Cost con categoria 'opere_civili'. Le aliquote definitive devono essere validate per il singolo contratto." : "Civil works use the structural rate only when entered as an Additional Cost with category 'opere_civili'. Final rates must be validated for the individual contract."}</p>
  </section>;
}

export function VatSummaryCard({ p, r }) {
  const it = p.language === "it";
  const summary = calculateVatSummary(p, r);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  const payback = summary.municipalityPayback == null ? "-" : `${formatNumber(summary.municipalityPayback, p.language, 1)} ${it ? "anni" : "years"}`;
  return <section className="card">
    <h2>{it ? "Impatto IVA per il Comune" : "Municipality VAT impact"}</h2>
    <div className="kpis">
      <div className="kpi"><span>{it ? "CAPEX netto" : "Net CAPEX"}</span><strong>{money(summary.capexNet)}</strong></div>
      <div className="kpi"><span>{it ? "IVA non recuperabile" : "Unrecoverable VAT"}</span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div className="kpi"><span>{it ? "CAPEX lordo Comune" : "Municipality gross CAPEX"}</span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div className="kpi"><span>{it ? "Payback Comune" : "Municipality payback"}</span><strong>{payback}</strong></div>
      <div className="kpi"><span>{it ? "VAN Comune" : "Municipality NPV"}</span><strong>{money(summary.municipalityNpv)}</strong></div>
    </div>
  </section>;
}
