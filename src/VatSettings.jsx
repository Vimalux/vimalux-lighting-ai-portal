import React from "react";
import { calculateVatSummary } from "./vat.js";
import { formatMoney, formatNumber } from "./i18n.js";
import {
  CUSTOMER_VAT_TYPES,
  customerVatSubject,
  normalizeCustomerVatType,
  vatDefaultForCustomerType,
} from "./customerVatProfile.js";

const Numeric = ({ value, onChange }) => <input inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;

export default function VatSettings({ p, r, update }) {
  const it = p.language === "it";
  const a = p.assumptions || {};
  const summary = calculateVatSummary(p, r);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  const customerType = normalizeCustomerVatType(p.customer?.customerType);
  const subject = customerVatSubject(p, p.language);
  const handleCustomerType = (value) => {
    update(["customer", "customerType"], value);
    const defaults = vatDefaultForCustomerType(value);
    if (!defaults) return;
    update(["assumptions", "vatRecoverability"], defaults.mode);
    update(["assumptions", "vatRecoverablePercent"], defaults.recoverablePercent);
  };
  return <section className="card">
    <h2>{it ? `IVA e cash-flow del ${subject}` : `VAT & ${subject} cash-flow`}</h2>
    <p className="hint">{it ? `I valori commerciali VIMALUX restano al netto IVA. Questa sezione calcola separatamente l'IVA non recuperabile e il cash-out effettivo del ${subject}.` : `VIMALUX commercial values remain net of VAT. This section separately calculates unrecoverable VAT and the ${subject}'s effective cash-out.`}</p>
    <div className="form-grid">
      <label><span>{it ? "Tipo cliente" : "Customer type"}</span><select value={customerType} onChange={(e) => handleCustomerType(e.target.value)}>{CUSTOMER_VAT_TYPES.map((item) => <option key={item.id} value={item.id}>{it ? item.it : item.en}</option>)}</select></label>
      <label><span>{it ? "IVA recuperabile dal cliente" : "VAT recoverable by customer"}</span><select value={a.vatRecoverability || "non_deductible"} onChange={(e) => update(["assumptions","vatRecoverability"], e.target.value)}><option value="non_deductible">{it ? "0% · Non recuperabile" : "0% · Non-recoverable"}</option><option value="deductible">{it ? "100% · Recuperabile" : "100% · Recoverable"}</option><option value="partial">{it ? "Parziale / manuale" : "Partial / manual"}</option></select></label>
      {a.vatRecoverability === "partial" && <label><span>{it ? "% IVA recuperabile" : "% recoverable VAT"}</span><Numeric value={a.vatRecoverablePercent ?? 0} onChange={(v) => update(["assumptions","vatRecoverablePercent"], v)} /></label>}
      <label><span>{it ? "IVA hardware / retrofit %" : "Hardware / retrofit VAT %"}</span><Numeric value={a.vatHardwarePercent ?? 22} onChange={(v) => update(["assumptions","vatHardwarePercent"], v)} /></label>
      <label><span>{it ? "IVA software / servizi digitali %" : "Software / digital services VAT %"}</span><Numeric value={a.vatDigitalPercent ?? 22} onChange={(v) => update(["assumptions","vatDigitalPercent"], v)} /></label>
      <label><span>{it ? "IVA manutenzione %" : "Maintenance VAT %"}</span><Numeric value={a.vatMaintenancePercent ?? 22} onChange={(v) => update(["assumptions","vatMaintenancePercent"], v)} /></label>
      <label><span>{it ? "IVA opere strutturali qualificate %" : "Qualified structural works VAT %"}</span><Numeric value={a.vatStructuralPercent ?? 10} onChange={(v) => update(["assumptions","vatStructuralPercent"], v)} /></label>
    </div>
    <p className="hint">{it ? "Il tipo cliente imposta solo un valore predefinito: Comune / ente pubblico = 0%; ESCO / impresa = 100%. La detraibilità resta sempre modificabile manualmente per il singolo contratto." : "Customer type only sets a default: municipality / public authority = 0%; ESCO / company = 100%. Recoverability always remains manually editable for the individual contract."}</p>
    <div className="breakdown">
      <div><span>{it ? "CAPEX netto VIMALUX" : "VIMALUX net CAPEX"}</span><span></span><strong>{money(summary.capexNet)}</strong></div>
      <div><span>{it ? "IVA CAPEX non recuperabile" : "Unrecoverable CAPEX VAT"}</span><span></span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div><span>{it ? `Cash-out CAPEX ${subject}` : `${subject} CAPEX cash-out`}</span><span></span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div><span>{it ? "OPEX annuo netto" : "Net annual OPEX"}</span><span></span><strong>{money(summary.annualOpexNet)}</strong></div>
      <div><span>{it ? "IVA OPEX annua non recuperabile" : "Unrecoverable annual OPEX VAT"}</span><span></span><strong>{money(summary.unrecoverableAnnualOpexVat)}</strong></div>
      <div><span>{it ? `Cash-out annuo ${subject}` : `${subject} annual cash-out`}</span><span></span><strong>{money(summary.municipalityAnnualOpexCash)}</strong></div>
    </div>
    <p className="hint">{it ? "Le opere civili sono trattate al tasso strutturale solo quando inserite come Additional Cost con categoria 'opere_civili'. Le aliquote definitive devono essere validate per il singolo contratto." : "Civil works use the structural rate only when entered as an Additional Cost with category 'opere_civili'. Final rates must be validated for the individual contract."}</p>
  </section>;
}

export function VatSummaryCard({ p, r }) {
  const it = p.language === "it";
  const summary = calculateVatSummary(p, r);
  const subject = customerVatSubject(p, p.language);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  const payback = summary.municipalityPayback == null ? "-" : `${formatNumber(summary.municipalityPayback, p.language, 1)} ${it ? "anni" : "years"}`;
  return <section className="card">
    <h2>{it ? `Impatto IVA per il ${subject}` : `${subject} VAT impact`}</h2>
    <div className="kpis">
      <div className="kpi"><span>{it ? "CAPEX netto" : "Net CAPEX"}</span><strong>{money(summary.capexNet)}</strong></div>
      <div className="kpi"><span>{it ? "IVA non recuperabile" : "Unrecoverable VAT"}</span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div className="kpi"><span>{it ? `CAPEX lordo ${subject}` : `${subject} gross CAPEX`}</span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div className="kpi"><span>{it ? `Payback ${subject}` : `${subject} payback`}</span><strong>{payback}</strong></div>
      <div className="kpi"><span>{it ? `VAN ${subject}` : `${subject} NPV`}</span><strong>{money(summary.municipalityNpv)}</strong></div>
    </div>
  </section>;
}
