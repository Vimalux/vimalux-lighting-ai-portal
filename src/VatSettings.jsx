import React from "react";
import { calculateVatSummary } from "./vat.js";
import { formatMoney, formatNumber } from "./i18n.js";
import { vatT } from "./vatCopy.js";
import {
  CUSTOMER_VAT_TYPES,
  normalizeCustomerVatType,
  vatDefaultForCustomerType,
} from "./customerVatProfile.js";

const Numeric = ({ value, onChange }) => <input inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;

export default function VatSettings({ p, r, update }) {
  const t = (key) => vatT(p.language, key);
  const a = p.assumptions || {};
  const summary = calculateVatSummary(p, r);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  const customerType = normalizeCustomerVatType(p.customer?.customerType);
  const handleCustomerType = (value) => {
    update(["customer", "customerType"], value);
    const defaults = vatDefaultForCustomerType(value);
    if (!defaults) return;
    update(["assumptions", "vatRecoverability"], defaults.mode);
    update(["assumptions", "vatRecoverablePercent"], defaults.recoverablePercent);
  };
  return <section className="card">
    <h2>{t("title")}</h2>
    <p className="hint">{t("intro")}</p>
    <div className="form-grid">
      <label><span>{t("customerType")}</span><select value={customerType} onChange={(e) => handleCustomerType(e.target.value)}>{CUSTOMER_VAT_TYPES.map((item) => <option key={item.id} value={item.id}>{item[p.language] || item.en}</option>)}</select></label>
      <label><span>{t("recoverableByCustomer")}</span><select value={a.vatRecoverability || "non_deductible"} onChange={(e) => update(["assumptions","vatRecoverability"], e.target.value)}><option value="non_deductible">{t("nonrecoverable")}</option><option value="deductible">{t("recoverable")}</option><option value="partial">{t("partial")}</option></select></label>
      {a.vatRecoverability === "partial" && <label><span>{t("recoverablePct")}</span><Numeric value={a.vatRecoverablePercent ?? 0} onChange={(v) => update(["assumptions","vatRecoverablePercent"], v)} /></label>}
      <label><span>{t("hardware")}</span><Numeric value={a.vatHardwarePercent ?? 22} onChange={(v) => update(["assumptions","vatHardwarePercent"], v)} /></label>
      <label><span>{t("digital")}</span><Numeric value={a.vatDigitalPercent ?? 22} onChange={(v) => update(["assumptions","vatDigitalPercent"], v)} /></label>
      <label><span>{t("maintenance")}</span><Numeric value={a.vatMaintenancePercent ?? 22} onChange={(v) => update(["assumptions","vatMaintenancePercent"], v)} /></label>
      <label><span>{t("structural")}</span><Numeric value={a.vatStructuralPercent ?? 10} onChange={(v) => update(["assumptions","vatStructuralPercent"], v)} /></label>
    </div>
    <p className="hint">{t("defaultNote")}</p>
    <div className="breakdown">
      <div><span>{t("capexNet")}</span><span></span><strong>{money(summary.capexNet)}</strong></div>
      <div><span>{t("capexVat")}</span><span></span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div><span>{t("capexCash")}</span><span></span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div><span>{t("opexNet")}</span><span></span><strong>{money(summary.annualOpexNet)}</strong></div>
      <div><span>{t("opexVat")}</span><span></span><strong>{money(summary.unrecoverableAnnualOpexVat)}</strong></div>
      <div><span>{t("opexCash")}</span><span></span><strong>{money(summary.municipalityAnnualOpexCash)}</strong></div>
    </div>
    <p className="hint">{t("civilNote")}</p>
  </section>;
}

export function VatSummaryCard({ p, r }) {
  const t = (key) => vatT(p.language, key);
  const summary = calculateVatSummary(p, r);
  const money = (value) => formatMoney(value, p.language, p.project.currency);
  const dealType = String(r.dealType || p.assumptions?.dealType || "cash").toLowerCase();
  const customerCashNpv = Number(r.customerCashNpv ?? summary.municipalityNpv) || 0;
  const financingMonthly = Math.max(0, Number(r.financingMonthlyPayment) || 0);
  const serviceMonthly = Math.max(0, Number(r.totalAnnualOpex ?? r.annualOpex) || 0) / 12;
  const totalMonthlyNet = Math.max(0, Number(r.customerMonthlyPaymentNet ?? r.monthlyPayment) || financingMonthly + serviceMonthly);
  const totalMonthlyGross = Math.max(totalMonthlyNet, Number(r.customerGrossMonthlyPayment) || totalMonthlyNet);
  const unrecoverableMonthlyVat = Math.max(0, totalMonthlyGross - totalMonthlyNet);

  if (dealType === "noleggio_operativo") {
    return <section className="card">
      <h2>{t("vatImpact")}</h2>
      <div className="kpis">
        <div className="kpi"><span>{t("monthlyNet")}</span><strong>{money(totalMonthlyNet)}</strong></div>
        <div className="kpi"><span>{t("monthlyVat")}</span><strong>{money(unrecoverableMonthlyVat)}</strong></div>
        <div className="kpi"><span>{t("monthlyGross")}</span><strong>{money(totalMonthlyGross)}</strong></div>
        <div className="kpi"><span>{t("financedCapex")}</span><strong>{money(summary.capexNet)}</strong></div>
        <div className="kpi"><span>{t("npv")}</span><strong>{money(customerCashNpv)}</strong></div>
      </div>
    </section>;
  }

  if (dealType === "finance") {
    return <section className="card">
      <h2>{t("vatImpact")}</h2>
      <div className="kpis">
        <div className="kpi"><span>{t("monthlyFinancing")}</span><strong>{money(financingMonthly)}</strong></div>
        <div className="kpi"><span>{t("monthlyService")}</span><strong>{money(serviceMonthly)}</strong></div>
        <div className="kpi"><span>{t("totalMonthlyNet")}</span><strong>{money(totalMonthlyNet)}</strong></div>
        <div className="kpi"><span>{t("monthlyVat")}</span><strong>{money(unrecoverableMonthlyVat)}</strong></div>
        <div className="kpi"><span>{t("totalMonthlyGross")}</span><strong>{money(totalMonthlyGross)}</strong></div>
        <div className="kpi"><span>{t("npv")}</span><strong>{money(customerCashNpv)}</strong></div>
      </div>
    </section>;
  }

  const payback = summary.municipalityPayback == null ? "-" : `${formatNumber(summary.municipalityPayback, p.language, 1)} ${t("years")}`;
  return <section className="card">
    <h2>{t("vatImpact")}</h2>
    <div className="kpis">
      <div className="kpi"><span>{t("netCapex")}</span><strong>{money(summary.capexNet)}</strong></div>
      <div className="kpi"><span>{t("nonrecoverableVat")}</span><strong>{money(summary.unrecoverableCapexVat)}</strong></div>
      <div className="kpi"><span>{t("grossCapex")}</span><strong>{money(summary.municipalityCapexCash)}</strong></div>
      <div className="kpi"><span>{t("payback")}</span><strong>{payback}</strong></div>
      <div className="kpi"><span>{t("npv")}</span><strong>{money(customerCashNpv)}</strong></div>
    </div>
  </section>;
}
