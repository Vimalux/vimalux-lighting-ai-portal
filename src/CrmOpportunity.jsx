import React, { useEffect, useMemo, useState } from "react";
import { crmMetrics, formatProbabilityPoints, pipelineStageTotals, pipelineTotals } from "./crm.js";
import { buildPlannerHandoff, canCreatePlannerProject, canonicalOpportunityFromProject } from "./opportunity.js";
import { parseOpportunityWorkbook, validateOpportunity } from "./opportunityImport.js";
import { readLightingWorkbook } from "./lightingImport.js";
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

function ImportModal({ close, apply, currentUser }) {
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
    <div className="modal-head"><div><h2>Import Data</h2><p>Upload → Validate → Preview → Import / Update</p></div><button onClick={close}>×</button></div>
    <div className="wizard-steps">{["Upload", "Validate", "Preview", "Import / Update"].map((label, index) => <span className={step >= index + 1 ? "active" : ""} key={label}>{index + 1}. {label}</span>)}</div>
    <div className="form-grid">
      <Field label="Import source" value={source} onChange={setSource}>
        <option value="agent">VML Agent Input Sheet</option><option value="legacy">Existing CRM Import</option>
      </Field>
      <label className="field"><span>Excel / CSV file</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setStep(1); setParsed(null); setErrors([]); }} /></label>
    </div>
    {errors.length > 0 && <div className="validation-errors"><strong>Validation errors</strong>{errors.map((error, index) => <div key={`${error.field}-${index}`}>{error.row ? `Row ${error.row}: ` : ""}{error.message}</div>)}</div>}
    {parsed && <div className="import-preview"><div><strong>{parsed.sourceFormat}</strong><small>Template {parsed.templateVersion}</small></div><div><strong>{parsed.opportunities.length}</strong><small>opportunity record(s)</small></div></div>}
    {parsed && step >= 3 && <div className="preview-table"><table><thead><tr><th>Opportunity ID</th><th>Municipality</th><th>Project</th><th>Stage</th><th>Finance / Service / Analysis</th></tr></thead><tbody>{parsed.opportunities.map((opportunity, index) => <tr key={opportunity.opportunity.opportunityId || index}><td>{opportunity.opportunity.opportunityId || "Legacy match"}</td><td>{opportunity.customer.municipalityName}</td><td>{opportunity.opportunity.projectName}</td><td>{opportunity.opportunity.stage}</td><td>{opportunity.commercial.financingPeriodYears || "—"} / {opportunity.commercial.serviceAgreementPeriodYears || "—"} / {opportunity.commercial.analysisPeriodYears || "—"}</td></tr>)}</tbody></table></div>}
    <div className="modal-actions"><button className="secondary" onClick={close}>Cancel</button>{step < 3 && <button onClick={validate} disabled={!file || busy}>{busy ? "Validating…" : "Validate"}</button>}{parsed && step >= 3 && <button onClick={() => { setStep(4); apply(parsed, { fileName: file.name, importedBy: currentUser }); }}>Import / Update</button>}</div>
  </section></div>;
}

export default function CrmOpportunity({ projects, active, update, money, onImport, onManual, setView, currentUser, getLinkedBusinessCaseId, createOrOpenBusinessCase, onBusinessCaseLinked }) {
  const [importOpen, setImportOpen] = useState(false);
  const [linkedCaseId, setLinkedCaseId] = useState(() => existingBusinessCaseRecordId(active));
  const [businessCaseBusy, setBusinessCaseBusy] = useState(false);
  const [businessCaseError, setBusinessCaseError] = useState("");
  const totals = pipelineTotals(projects);
  const stages = pipelineStageTotals(projects);
  const row = crmMetrics(active);
  const canonical = useMemo(() => canonicalOpportunityFromProject(active), [active]);
  const bc = active.crm?.businessCase || {};
  const probability = (value) => formatProbabilityPoints(value, active.language);
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
  return <>
    <div className="crm-toolbar"><button className="primary" onClick={() => setImportOpen(true)}>New Opportunity · Import Data</button><button onClick={onManual}>Enter manually</button></div>
    <div className="kpis"><Kpi label="Total TCV" value={money(totals.totalContractValue)} /><Kpi label="Weighted TCV" value={money(totals.weightedTcv)} /><Kpi label="ARR" value={money(totals.annualRecurringRevenue)} /><Kpi label="Weighted ARR" value={money(totals.weightedArr)} /></div>
    <div className="cards-grid">{stages.map((stage) => <Card title={stage.stage[0].toUpperCase() + stage.stage.slice(1)} key={stage.stage}><div className="breakdown"><div><span>Opportunities</span><span></span><strong>{stage.count}</strong></div><div><span>Average probability</span><span></span><strong>{probability(stage.averageProbability)}</strong></div><div><span>TCV</span><span></span><strong>{money(stage.totalContractValue)}</strong></div><div><span>Weighted TCV</span><span></span><strong>{money(stage.weightedTcv)}</strong></div></div></Card>)}</div>
    <Card title={`Opportunity · ${canonical.opportunity.projectName}`} className="opportunity-detail">
      <div className="opportunity-section"><h3>A. Customer</h3><div className="form-grid"><Field label="Customer ID" value={canonical.customer.customerId} onChange={(v) => update(["crm", "customerId"], v)} /><Field label="Municipality" value={canonical.customer.municipalityName} onChange={(v) => update(["customer", "name"], v)} /><Field label="Province" value={canonical.customer.province} onChange={(v) => update(["customer", "province"], v)} /><Field label="Region" value={canonical.customer.region} onChange={(v) => update(["customer", "region"], v)} /><Field label="Contact" value={canonical.contact.name} onChange={(v) => update(["customer", "contact"], v)} /><Field label="Agent" value={canonical.source.agentName} onChange={(v) => update(["crm", "agentName"], v)} /><Field label="Lead source" value={canonical.source.source} onChange={(v) => update(["crm", "source"], v)} /></div></div>
      <div className="opportunity-section"><h3>B. Pipeline</h3><div className="form-grid"><Field label="Opportunity ID" value={canonical.opportunity.opportunityId} onChange={(v) => update(["crm", "opportunityId"], v)} /><Field label="Stage" value={row.status} onChange={(v) => update(["crm", "status"], v)}><option value="lead">Lead</option><option value="qualified">Qualified</option><option value="proposal">Proposal</option><option value="negotiation">Negotiation</option><option value="closing">Closing</option><option value="won">Won</option><option value="lost">Lost</option></Field><Field label="Probability (%)" value={row.probability} onChange={(v) => update(["crm", "closingProbability"], v)} /><Field label="Expected close" type="date" value={canonical.opportunity.expectedCloseDate} onChange={(v) => update(["crm", "expectedCloseDate"], v)} /><Field label="GO status" value={canonical.opportunity.goStatus} onChange={(v) => update(["crm", "goStatus"], v)}><option value="">Not calculated</option><option value="GO">GO</option><option value="REVIEW">REVIEW</option><option value="NO_GO">NO-GO</option></Field><Field label="Notes" value={canonical.opportunity.notes} onChange={(v) => update(["crm", "notes"], v)} /></div></div>
      <div className="opportunity-section"><h3>C. Preliminary Project Data</h3><div className="detail-grid"><span>Luminaires<strong>{canonical.assumptions.totalLuminaires}</strong></span><span>Existing technology<strong>{canonical.assumptions.existingTechnology || "—"}</strong></span><span>Average watt<strong>{canonical.assumptions.averageExistingWatt.toFixed(1)} W</strong></span><span>Annual hours<strong>{canonical.assumptions.annualOperatingHours}</strong></span><span>Energy price<strong>{canonical.assumptions.energyPrice}</strong></span><span>Dimming<strong>{canonical.assumptions.existingDimmingProfile} · {canonical.assumptions.existingDimmingPct}%</strong></span><span>Smart / CMS / PowerAiD<strong>{canonical.assumptions.smartLightingEnabled ? "Yes" : "No"} / {canonical.assumptions.cmsEnabled ? "Yes" : "No"} / {canonical.assumptions.powerAidEnabled ? "Yes" : "No"}</strong></span></div></div>
      <div className="opportunity-section"><h3>D. Commercial Structure</h3><div className="detail-grid"><span>Model<strong>{canonical.commercial.financingModel}</strong></span><span>Financing Period<strong>{canonical.commercial.financingPeriodYears} years</strong></span><span>Service Agreement Period<strong>{canonical.commercial.serviceAgreementPeriodYears} years</strong></span><span>Analysis Period<strong>{canonical.commercial.analysisPeriodYears} years</strong></span></div></div>
      <div className="opportunity-section"><h3>E. Preliminary Business Case</h3><p className="muted">{bc.calculatedAt ? `Business Case updated: ${new Date(bc.calculatedAt).toLocaleString()}` : "Business Case has not yet been calculated."}</p><div className="detail-grid"><span>CAPEX<strong>{money(bc.capex || 0)}</strong></span><span>Annual OPEX<strong>{money(bc.annualOpex || 0)}</strong></span><span>Customer payment annual / monthly<strong>{money(bc.annualCustomerPayment || 0)} / {money(bc.monthlyCustomerPayment || 0)}</strong></span><span>TCV<strong>{money(bc.tcv || 0)}</strong></span><span>ARR / MRR<strong>{money(bc.arr || 0)} / {money(bc.mrr || 0)}</strong></span><span>Annual net benefit<strong>{money(bc.annualCustomerNetBenefit || 0)}</strong></span><span>Payback<strong>{bc.paybackYears == null ? "—" : `${Number(bc.paybackYears).toFixed(1)} years`}</strong></span><span>NPV / lifecycle<strong>{money(bc.npv || 0)} / {money(bc.lifecycleResult || 0)}</strong></span><span>Energy / CO₂<strong>{Number(bc.energyReductionPct || 0).toFixed(1)}% / {Number(bc.co2ReductionTons || 0).toFixed(1)} t</strong></span><span>Smart nodes<strong>{bc.smartNodeCount || 0}</strong></span><span>DATEK ARR / contract value<strong>{money(bc.datekArr || 0)} / {money(bc.datekContractValue || 0)}</strong></span><span>PowerAiD fee / supplier / margin<strong>{money(bc.powerAidCustomerFee || 0)} / {money(bc.powerAidSupplierCost || 0)} / {money(bc.powerAidVimaluxMargin || 0)}</strong></span></div></div>
      <div className="opportunity-section"><h3>F. Actions</h3>{businessCaseError && <div className="sync-error" role="alert">{businessCaseError}</div>}<div className="crm-toolbar"><button onClick={() => setView("customer")}>Edit Opportunity</button><button className="primary" onClick={openBusinessCase} disabled={businessCaseBusy}>{businessCaseBusy ? "…" : businessCaseActionLabel(Boolean(linkedCaseId), active.language)}</button><button onClick={() => setView("report")} disabled={!bc.calculatedAt}>Generate Report</button><button disabled={!plannerReady} title={!plannerReady ? "Requires GO and a calculated Preliminary Business Case" : "Ready for Planner handoff"} onClick={() => update(["crm", "plannerHandoff"], buildPlannerHandoff(active))}>Create Planner Project</button></div></div>
    </Card>
    <Card title="Import History / Audit"><div className="preview-table"><table><thead><tr><th>Timestamp</th><th>File</th><th>Source</th><th>Imported by</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Errors</th></tr></thead><tbody>{history.length ? history.map((item) => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString()}</td><td>{item.fileName}</td><td>{item.sourceFormat} · {item.templateVersion}</td><td>{item.importedBy || "—"}</td><td>{item.created}</td><td>{item.updated}</td><td>{item.skipped}</td><td>{item.errors}</td></tr>) : <tr><td colSpan="8">No imports recorded yet.</td></tr>}</tbody></table></div></Card>
    {importOpen && <ImportModal close={() => setImportOpen(false)} currentUser={currentUser} apply={(parsed, meta) => { onImport(parsed, meta); setImportOpen(false); }} />}
  </>;
}
