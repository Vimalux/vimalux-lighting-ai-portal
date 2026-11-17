import React, { useEffect, useMemo, useState } from "react";
import { crmMetrics, formatProbabilityPoints, isArchivedOpportunity, pipelineStageTotals, pipelineTotals } from "./crm.js";
import { buildPlannerHandoff, canCreatePlannerProject, canonicalOpportunityFromProject } from "./opportunity.js";
import { parseOpportunityWorkbook, validateOpportunity } from "./opportunityImport.js";
import { readLightingWorkbook } from "./lightingImport.js";
import { crmT } from "./crmCopy.js";
import { locale } from "./i18n.js";
import {
  businessCaseActionLabel,
  existingBusinessCaseRecordId,
  linkedBusinessCaseUrl,
} from "./crmBusinessCase.js";

const Field = ({ label, value, onChange, children, type = "text", disabled = false }) => (
  <label className="field"><span>{label}</span>{children ? <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={disabled}>{children}</select> : <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={disabled} />}</label>
);
const Kpi = ({ label, value }) => <div className="kpi"><span>{label}</span><strong>{value}</strong></div>;
const Card = ({ title, children, className = "" }) => <section className={`card ${className}`}><h2>{title}</h2>{children}</section>;

const ARCHIVE_REASONS = ["not_relevant", "municipality_not_interested", "lost_to_competitor", "duplicate", "created_by_mistake", "on_hold", "other"];

function ArchiveModal({ close, apply, projectName, language }) {
  const t = (key) => crmT(language, key);
  const [reasonCode, setReasonCode] = useState("");
  const [reason, setReason] = useState("");
  const selectedLabel = reasonCode ? t(`archiveReason_${reasonCode}`) : "";
  const valid = Boolean(reasonCode && (reasonCode !== "other" || reason.trim()));
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><section className="import-modal crm-import-modal">
    <div className="modal-head"><div><h2>{t("archive")}</h2><p>{projectName}</p></div><button onClick={close} aria-label={t("close")}>×</button></div>
    <div className="form-grid">
      <Field label={t("reason")} value={reasonCode} onChange={setReasonCode}>
        <option value="">{t("select")}</option>
        {ARCHIVE_REASONS.map((code) => <option key={code} value={code}>{t(`archiveReason_${code}`)}</option>)}
      </Field>
      <Field label={t("note")} value={reason} onChange={setReason} />
    </div>
    <p className="muted">{t("archiveDisclosure")}</p>
    <div className="modal-actions"><button className="secondary" onClick={close}>{t("cancel")}</button><button className="primary" disabled={!valid} onClick={() => apply({ reasonCode, reason: reason.trim() || selectedLabel })}>{t("archiveAction")}</button></div>
  </section></div>;
}

function ImportModal({ close, apply, currentUser, language }) {
  const t = (key) => crmT(language, key);
  const [source, setSource] = useState("agent");
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const validate = async () => {
    if (!file) return;
    setBusy(true); setErrors([]);
    try {
      const sheets = await readLightingWorkbook(file);
      const result = parseOpportunityWorkbook(sheets, source);
      const validation = result.opportunities.flatMap((opportunity, index) => validateOpportunity(opportunity).map((error) => ({ ...error, row: index + 1 })));
      setParsed(result); setErrors(validation); setStep(validation.length ? 2 : 3);
    } catch (error) { setErrors([{ message: error.message }]); setStep(2); }
    setBusy(false);
  };
  return <div className="modal-backdrop"><section className="import-modal crm-import-modal">
    <div className="modal-head"><div><h2>{t("importData")}</h2><p>{t("importSteps")}</p></div><button onClick={close} aria-label={t("close")}>×</button></div>
    <div className="wizard-steps">{["upload", "validate", "preview", "importUpdate"].map((key, index) => <span className={step >= index + 1 ? "active" : ""} key={key}>{index + 1}. {t(key)}</span>)}</div>
    <div className="form-grid">
      <Field label={t("importSource")} value={source} onChange={setSource}>
        <option value="agent">{t("agentImport")}</option><option value="legacy">{t("legacyImport")}</option>
      </Field>
      <label className="field"><span>{t("uploadFile")}</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setStep(1); setParsed(null); setErrors([]); }} /></label>
    </div>
    {errors.length > 0 && <div className="validation-errors"><strong>{t("validationErrors")}</strong>{errors.map((error, index) => <div key={`${error.field}-${index}`}>{error.row ? `${t("row")} ${error.row}: ` : ""}{error.message}</div>)}</div>}
    {parsed && <div className="import-preview"><div><strong>{parsed.sourceFormat}</strong><small>{t("template")} {parsed.templateVersion}</small></div><div><strong>{parsed.opportunities.length}</strong><small>{t("records")}</small></div></div>}
    {parsed && step >= 3 && <div className="preview-table"><table><thead><tr><th>{t("opportunityId")}</th><th>{t("municipality")}</th><th>{t("project")}</th><th>{t("stage")}</th><th>{t("financeServiceAnalysis")}</th></tr></thead><tbody>{parsed.opportunities.map((opportunity, index) => <tr key={opportunity.opportunity.opportunityId || index}><td>{opportunity.opportunity.opportunityId || t("legacyMatch")}</td><td>{opportunity.customer.municipalityName}</td><td>{opportunity.opportunity.projectName}</td><td>{t(opportunity.opportunity.stage)}</td><td>{opportunity.commercial.financingPeriodYears || "—"} / {opportunity.commercial.serviceAgreementPeriodYears || "—"} / {opportunity.commercial.analysisPeriodYears || "—"}</td></tr>)}</tbody></table></div>}
    <div className="modal-actions"><button className="secondary" onClick={close}>{t("cancel")}</button>{step < 3 && <button onClick={validate} disabled={!file || busy}>{busy ? t("validating") : t("validate")}</button>}{parsed && step >= 3 && <button onClick={() => { setStep(4); apply(parsed, { fileName: file.name, importedBy: currentUser }); }}>{t("importUpdate")}</button>}</div>
  </section></div>;
}

export default function CrmOpportunity({ projects, active, update, money, onImport, onManual, setView, currentUser, getLinkedBusinessCaseId, createOrOpenBusinessCase, onBusinessCaseLinked }) {
  const [importOpen, setImportOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [linkedCaseId, setLinkedCaseId] = useState(() => existingBusinessCaseRecordId(active));
  const [businessCaseBusy, setBusinessCaseBusy] = useState(false);
  const [businessCaseError, setBusinessCaseError] = useState("");
  const totals = pipelineTotals(projects);
  const stages = pipelineStageTotals(projects);
  const row = crmMetrics(active);
  const canonical = useMemo(() => canonicalOpportunityFromProject(active), [active]);
  const archived = isArchivedOpportunity(active);
  const bc = active.crm?.businessCase || {};
  const probability = (value) => formatProbabilityPoints(value, active.language);
  const t = (key) => crmT(active.language, key);
  const opportunityId = canonical.opportunity.opportunityId || active.id;
  const plannerReady = canCreatePlannerProject(active);
  const history = [...new Map(projects.flatMap((project) => project.crm?.importHistory || []).map((item) => [item.id, item])).values()].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  useEffect(() => {
    let current = true;
    const storedId = existingBusinessCaseRecordId(active);
    setLinkedCaseId(storedId);
    setBusinessCaseError("");
    if (!getLinkedBusinessCaseId) return () => { current = false; };
    setBusinessCaseBusy(true);
    getLinkedBusinessCaseId(opportunityId)
      .then((caseId) => {
        if (!current) return;
        setLinkedCaseId(caseId || "");
        if (caseId) onBusinessCaseLinked?.({ opportunityId, caseId });
      })
      .catch((error) => {
        if (current) setBusinessCaseError(error.message);
      })
      .finally(() => {
        if (current) setBusinessCaseBusy(false);
      });
    return () => { current = false; };
  }, [active.id, opportunityId, getLinkedBusinessCaseId, onBusinessCaseLinked]);
  const openBusinessCase = async () => {
    if (!createOrOpenBusinessCase || businessCaseBusy) return;
    setBusinessCaseBusy(true);
    setBusinessCaseError("");
    try {
      const caseId = await createOrOpenBusinessCase(opportunityId);
      setLinkedCaseId(caseId);
      onBusinessCaseLinked?.({ opportunityId, caseId });
      window.open(linkedBusinessCaseUrl(caseId, window.location.origin), "_blank", "noopener,noreferrer");
    } catch (error) {
      setBusinessCaseError(error.message);
    } finally {
      setBusinessCaseBusy(false);
    }
  };
  const archiveOpportunity = ({ reasonCode, reason }) => {
    const now = new Date().toISOString();
    update(["crm"], {
      ...(active.crm || {}),
      archivedAt: now,
      archivedBy: currentUser || "",
      archiveReasonCode: reasonCode,
      archiveReason: reason,
      archiveStatusBefore: active.crm?.status || "lead",
    });
    setArchiveOpen(false);
  };
  return <>
    <div className="crm-toolbar"><button className="primary" onClick={() => setImportOpen(true)}>{t("import")}</button><button onClick={onManual}>{t("manual")}</button></div>
    <div className="kpis"><Kpi label={t("totalTcv")} value={money(totals.totalContractValue)} /><Kpi label={t("weightedTcv")} value={money(totals.weightedTcv)} /><Kpi label={t("arr")} value={money(totals.annualRecurringRevenue)} /><Kpi label={t("weightedArr")} value={money(totals.weightedArr)} /></div>
    <div className="cards-grid">{stages.map((stage) => <Card title={t(stage.stage)} key={stage.stage}><div className="breakdown"><div><span>{t("opportunities")}</span><span></span><strong>{stage.count}</strong></div><div><span>{t("avgProbability")}</span><span></span><strong>{probability(stage.averageProbability)}</strong></div><div><span>TCV</span><span></span><strong>{money(stage.totalContractValue)}</strong></div><div><span>{t("weightedTcv")}</span><span></span><strong>{money(stage.weightedTcv)}</strong></div></div></Card>)}</div>
    {archived && <div className="sync-error" role="status"><strong>{t("archived")}</strong> · {active.crm?.archiveReasonCode ? t(`archiveReason_${active.crm.archiveReasonCode}`) : active.crm?.archiveReason || "—"}{active.crm?.archivedBy ? ` · ${active.crm.archivedBy}` : ""}{active.crm?.archivedAt ? ` · ${new Date(active.crm.archivedAt).toLocaleString(locale(active.language))}` : ""}</div>}
    <Card title={`${t("opportunity")} · ${canonical.opportunity.projectName}`} className="opportunity-detail">
      <div className="opportunity-section"><h3>A. {t("customer")}</h3><div className="form-grid"><Field label={t("customerId")} value={canonical.customer.customerId} onChange={(v) => update(["crm", "customerId"], v)} /><Field label={t("municipality")} value={canonical.customer.municipalityName} onChange={(v) => update(["customer", "name"], v)} /><Field label={t("province")} value={canonical.customer.province} onChange={(v) => update(["customer", "province"], v)} /><Field label={t("region")} value={canonical.customer.region} onChange={(v) => update(["customer", "region"], v)} /><Field label={t("contact")} value={canonical.contact.name} onChange={(v) => update(["customer", "contact"], v)} /><Field label={t("agent")} value={canonical.source.agentName} onChange={(v) => update(["crm", "agentName"], v)} /><Field label={t("leadSource")} value={canonical.source.source} onChange={(v) => update(["crm", "source"], v)} /></div></div>
      <div className="opportunity-section"><h3>B. {t("pipeline")}</h3><div className="form-grid"><Field label={t("opportunityId")} value={canonical.opportunity.opportunityId} onChange={(v) => update(["crm", "opportunityId"], v)} /><Field label={t("stage")} value={row.status} onChange={(v) => update(["crm", "status"], v)}>{["lead", "qualified", "proposal", "negotiation", "closing", "won", "lost"].map((stage) => <option key={stage} value={stage}>{t(stage)}</option>)}</Field><Field label={t("probability")} value={row.probability} onChange={(v) => update(["crm", "closingProbability"], v)} /><Field label={t("expectedClose")} type="date" value={canonical.opportunity.expectedCloseDate} onChange={(v) => update(["crm", "expectedCloseDate"], v)} /><Field label={t("goStatus")} value={canonical.opportunity.goStatus} onChange={(v) => update(["crm", "goStatus"], v)}><option value="">{t("notCalculated")}</option><option value="GO">GO</option><option value="REVIEW">REVIEW</option><option value="NO_GO">NO-GO</option></Field><Field label={t("notes")} value={canonical.opportunity.notes} onChange={(v) => update(["crm", "notes"], v)} /></div></div>
      <div className="opportunity-section"><h3>C. {t("preliminary")}</h3><div className="detail-grid"><span>{t("luminaires")}<strong>{canonical.assumptions.totalLuminaires}</strong></span><span>{t("existingTechnology")}<strong>{canonical.assumptions.existingTechnology || "—"}</strong></span><span>{t("averageWatt")}<strong>{canonical.assumptions.averageExistingWatt.toFixed(1)} W</strong></span><span>{t("annualHours")}<strong>{canonical.assumptions.annualOperatingHours}</strong></span><span>{t("energyPrice")}<strong>{canonical.assumptions.energyPrice}</strong></span><span>{t("dimming")}<strong>{canonical.assumptions.existingDimmingProfile} · {canonical.assumptions.existingDimmingPct}%</strong></span><span>{t("smartCmsAdaptive")}<strong>{canonical.assumptions.smartLightingEnabled ? t("yes") : t("no")} / {canonical.assumptions.cmsEnabled ? t("yes") : t("no")} / {canonical.assumptions.powerAidEnabled ? t("yes") : t("no")}</strong></span></div></div>
      <div className="opportunity-section"><h3>D. {t("commercial")}</h3><div className="detail-grid"><span>{t("model")}<strong>{canonical.commercial.financingModel}</strong></span><span>{t("financingPeriod")}<strong>{canonical.commercial.financingPeriodYears} {t("years")}</strong></span><span>{t("servicePeriod")}<strong>{canonical.commercial.serviceAgreementPeriodYears} {t("years")}</strong></span><span>{t("analysisPeriod")}<strong>{canonical.commercial.analysisPeriodYears} {t("years")}</strong></span></div></div>
      <div className="opportunity-section"><h3>E. {t("businessCase")}</h3><p className="muted">{bc.calculatedAt ? `${t("businessCaseUpdated")}: ${new Date(bc.calculatedAt).toLocaleString(locale(active.language))}` : t("businessCaseNotCalculated")}</p><div className="detail-grid"><span>CAPEX<strong>{money(bc.capex || 0)}</strong></span><span>{t("annualOpex")}<strong>{money(bc.annualOpex || 0)}</strong></span><span>{t("customerPayment")}<strong>{money(bc.annualCustomerPayment || 0)} / {money(bc.monthlyCustomerPayment || 0)}</strong></span><span>TCV<strong>{money(bc.tcv || 0)}</strong></span><span>ARR / MRR<strong>{money(bc.arr || 0)} / {money(bc.mrr || 0)}</strong></span><span>{t("annualNet")}<strong>{money(bc.annualCustomerNetBenefit || 0)}</strong></span><span>{t("payback")}<strong>{bc.paybackYears == null ? "—" : `${Number(bc.paybackYears).toFixed(1)} ${t("years")}`}</strong></span><span>{t("npvLifecycle")}<strong>{money(bc.npv || 0)} / {money(bc.lifecycleResult || 0)}</strong></span><span>{t("energyCo2")}<strong>{Number(bc.energyReductionPct || 0).toFixed(1)}% / {Number(bc.co2ReductionTons || 0).toFixed(1)} t</strong></span><span>{t("smartNodes")}<strong>{bc.smartNodeCount || 0}</strong></span><span>{t("datekArr")}<strong>{money(bc.datekArr || 0)} / {money(bc.datekContractValue || 0)}</strong></span><span>{t("adaptiveFee")}<strong>{money(bc.powerAidCustomerFee || 0)} / {money(bc.powerAidSupplierCost || 0)} / {money(bc.powerAidVimaluxMargin || 0)}</strong></span></div></div>
      <div className="opportunity-section"><h3>F. {t("actions")}</h3>{businessCaseError && <div className="sync-error" role="alert">{businessCaseError}</div>}<div className="crm-toolbar"><button onClick={() => setView("customer")}>{t("edit")}</button><button className="primary" onClick={openBusinessCase} disabled={businessCaseBusy}>{businessCaseBusy ? "…" : businessCaseActionLabel(Boolean(linkedCaseId), active.language)}</button><button onClick={() => setView("report")} disabled={!bc.calculatedAt}>{t("generate")}</button><button disabled={!plannerReady || archived} title={archived ? t("plannerArchiveBlock") : !plannerReady ? t("plannerRequiresGo") : t("readyPlanner")} onClick={() => update(["crm", "plannerHandoff"], buildPlannerHandoff(active))}>{t("planner")}</button>{!archived && <button className="danger" onClick={() => setArchiveOpen(true)}>{t("archiveAction")}</button>}</div></div>
    </Card>
    <Card title={t("audit")}><div className="preview-table"><table><thead><tr>{["timestamp", "file", "source", "importedBy", "created", "updated", "skipped", "errors"].map((key) => <th key={key}>{t(key)}</th>)}</tr></thead><tbody>{history.length ? history.map((item) => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString(locale(active.language))}</td><td>{item.fileName}</td><td>{item.sourceFormat} · {item.templateVersion}</td><td>{item.importedBy || "—"}</td><td>{item.created}</td><td>{item.updated}</td><td>{item.skipped}</td><td>{item.errors}</td></tr>) : <tr><td colSpan="8">{t("noImports")}</td></tr>}</tbody></table></div></Card>
    {importOpen && <ImportModal language={active.language} close={() => setImportOpen(false)} currentUser={currentUser} apply={(parsed, meta) => { onImport(parsed, meta); setImportOpen(false); }} />}
    {archiveOpen && <ArchiveModal language={active.language} close={() => setArchiveOpen(false)} projectName={canonical.opportunity.projectName} apply={archiveOpportunity} />}
  </>;
}
