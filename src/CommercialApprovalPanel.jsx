import React, { useEffect, useState } from "react";
import { isStableCloudId } from "./businessCasePersistence.js";
import { stagingPreview, supabase } from "./supabase.js";
import { commercialReleaseLabel, commercialReleaseState, isFinalCommercialOfferAuthorized } from "./commercialApproval.js";

const approvalText = {
  en: {
    title: "Commercial approval — final offer",
    notice: "You may share the non-binding preliminary study/proposal with the client. A final, binding quotation must only be issued when VIMALUX has authorized it.",
    agent: "If the client requests a binding offer, request commercial approval from VIMALUX Admin. The preliminary proposal can still be shared today.",
    admin: "To release a final offer to an Agent, an Admin must explicitly approve this saved project version — including when the policy margin is met.",
    justification: "Admin justification for commercial release (required)",
    placeholder: "Reason, commercial terms and conditions",
    approve: "Authorize final offer for Agent",
    reason: "Admin reason: ",
    revoke: "Revoke authorization",
    expired: "Previous approval expired after a project update. A new approval is required.",
    assessment: (status, margin) => `Internal assessment: ${status}; minimum project margin: ${margin}%.`,
    approveFailed: "Approval failed", revokeFailed: "Revocation failed",
  },
  it: {
    title: "Autorizzazione commerciale — offerta definitiva",
    notice: "Puoi condividere con il cliente lo studio o la proposta preliminare non vincolante. L'offerta commerciale definitiva può essere emessa solo dopo l'autorizzazione VIMALUX.",
    agent: "Se il cliente richiede un'offerta vincolante, chiedi l'autorizzazione commerciale a VIMALUX Admin. La proposta preliminare può comunque essere condivisa ora.",
    admin: "Per autorizzare l'agente a emettere un'offerta definitiva, l'Admin deve approvare espressamente questa versione salvata — anche quando il margine minimo è rispettato.",
    justification: "Motivazione Admin per autorizzazione commerciale (obbligatoria)",
    placeholder: "Motivazione, termini e condizioni commerciali",
    approve: "Autorizza offerta definitiva per l'agente",
    reason: "Motivazione Admin: ",
    revoke: "Revoca autorizzazione",
    expired: "L'approvazione precedente è decaduta dopo una modifica del progetto. Serve una nuova approvazione.",
    assessment: (status, margin) => `Valutazione interna: ${status}; margine minimo di progetto: ${margin}%.`,
    approveFailed: "Autorizzazione non riuscita", revokeFailed: "Revoca non riuscita",
  },
  es: {
    title: "Autorización comercial — oferta definitiva",
    notice: "Puede compartir con el cliente el estudio o la propuesta preliminar no vinculante. Solo se podrá emitir una oferta definitiva y vinculante con la autorización de VIMALUX.",
    agent: "Si el cliente solicita una oferta vinculante, pida la aprobación comercial al administrador de VIMALUX. Mientras tanto, puede compartir la propuesta preliminar.",
    admin: "Para permitir que un agente emita una oferta definitiva, el administrador debe aprobar expresamente esta versión guardada del proyecto, incluso si cumple el margen mínimo.",
    justification: "Justificación del administrador para la autorización comercial (obligatoria)",
    placeholder: "Motivo, condiciones y términos comerciales",
    approve: "Autorizar oferta definitiva para el agente",
    reason: "Motivo del administrador: ",
    revoke: "Revocar autorización",
    expired: "La autorización anterior dejó de ser válida tras una modificación del proyecto. Se requiere una nueva aprobación.",
    assessment: (status, margin) => `Evaluación interna: ${status}; margen mínimo del proyecto: ${margin}%.`,
    approveFailed: "No se pudo autorizar", revokeFailed: "No se pudo revocar la autorización",
  },
  da: {
    title: "Kommerciel godkendelse — endeligt tilbud",
    notice: "Du må dele den ikke-bindende foreløbige analyse eller det foreløbige forslag med kunden. Et endeligt og bindende tilbud må først sendes efter godkendelse fra VIMALUX.",
    agent: "Hvis kunden ønsker et bindende tilbud, skal du bede VIMALUX Admin om kommerciel godkendelse. Det foreløbige forslag må stadig deles med kunden.",
    admin: "For at frigive et endeligt tilbud til en agent skal en administrator udtrykkeligt godkende denne gemte projektversion, også når minimumsavancen er opfyldt.",
    justification: "Administrators begrundelse for kommerciel frigivelse (påkrævet)",
    placeholder: "Begrundelse, kommercielle vilkår og betingelser",
    approve: "Godkend endeligt tilbud til agenten",
    reason: "Administrators begrundelse: ",
    revoke: "Tilbagekald godkendelse",
    expired: "Den tidligere godkendelse er bortfaldet efter en projektændring. Ny godkendelse er nødvendig.",
    assessment: (status, margin) => `Intern vurdering: ${status}; projektets minimumsavance: ${margin}%.`,
    approveFailed: "Godkendelsen mislykkedes", revokeFailed: "Tilbagekaldelsen mislykkedes",
  },
};

export function commercialApprovalUiT(language, key, ...args) {
  const value = (approvalText[language] || approvalText.en)[key];
  return typeof value === "function" ? value(...args) : value;
}

export function commercialApprovalUiCoverage() {
  return Object.fromEntries(Object.entries(approvalText).map(([language, copy]) => [language, Object.keys(approvalText.en).filter((key) => !copy[key])]));
}

export default function CommercialApprovalPanel({ project, result, isAgent = false, canApprove = false, syncState = "saved" }) {
  const ui = (key, ...args) => commercialApprovalUiT(project.language, key, ...args);
  const [approval, setApproval] = useState({ phase: "loading" });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const caseId = project.crm?.businessCaseRecordId || project.id;
  const isCloudCase = isStableCloudId(caseId);

  useEffect(() => {
    if (stagingPreview || !isCloudCase) {
      setApproval({ phase: "unavailable" });
      return;
    }
    if (syncState !== "saved") {
      setApproval({ phase: "loading" });
      return;
    }
    let active = true;
    setApproval({ phase: "loading" });
    supabase.rpc("get_intelligence_commercial_approval", { case_id: caseId })
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        setApproval(rpcError ? { phase: "error", fetchedUpdatedAt: project.updatedAt } : { phase: "loaded", fetchedUpdatedAt: project.updatedAt, ...(data || {}) });
      })
      .catch(() => { if (active) setApproval({ phase: "error", fetchedUpdatedAt: project.updatedAt }); });
    return () => { active = false; };
  }, [caseId, isCloudCase, syncState, project.updatedAt, refresh]);

  useEffect(() => {
    const refreshApproval = () => setRefresh((previous) => previous + 1);
    const interval = window.setInterval(refreshApproval, 45000);
    window.addEventListener("focus", refreshApproval);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refreshApproval); };
  }, []);

  // A locally edited project cannot borrow an approval fetched for an older edit.
  const currentApproval = approval.fetchedUpdatedAt === project.updatedAt ? approval : { phase: "loading" };
  const state = commercialReleaseState(result, currentApproval, syncState, isAgent);
  const allowed = isFinalCommercialOfferAuthorized(state);
  const isApprovalCandidate = result.customerDecisionStatus === "GO" && ["GO", "REVIEW"].includes(result.decisionStatus);

  const approve = async () => {
    if (reason.trim().length < 12 || busy || !canApprove || !isApprovalCandidate || !isCloudCase || syncState !== "saved") return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("approve_intelligence_commercial_exception", { case_id: caseId, approval_reason: reason.trim() });
      if (rpcError) throw rpcError;
      setApproval({ phase: "loaded", fetchedUpdatedAt: project.updatedAt, ...(data || {}) });
      setReason("");
    } catch (cause) { setError(cause.message || ui("approveFailed")); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (busy || !canApprove || !isCloudCase) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("revoke_intelligence_commercial_exception", { case_id: caseId });
      if (rpcError) throw rpcError;
      setApproval({ phase: "loaded", fetchedUpdatedAt: project.updatedAt, ...(data || {}) });
    } catch (cause) { setError(cause.message || ui("revokeFailed")); }
    finally { setBusy(false); }
  };

  return <section className={`commercial-approval ${allowed ? "authorized" : "pending"}`} data-commercial-release={state}>
    <div className="commercial-approval-head">
      <strong>{ui("title")}</strong>
      <span role="status">{commercialReleaseLabel(state, project.language)}</span>
    </div>
    <p>{ui("notice")}</p>
    {isAgent && !allowed && <small>{ui("agent")}</small>}
    {canApprove && isApprovalCandidate && !currentApproval.approved && <div className="commercial-approval-actions">
      <p>{ui("admin")}</p>
      <label>{ui("justification")}
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} placeholder={ui("placeholder")} />
      </label>
      <button className="secondary" type="button" disabled={busy || reason.trim().length < 12 || syncState !== "saved" || currentApproval.phase !== "loaded"} onClick={approve}>
        {ui("approve")}
      </button>
    </div>}
    {canApprove && currentApproval.phase === "loaded" && currentApproval.approved && <div className="commercial-approval-actions">
      {approval.approvalReason && <small>{ui("reason")}{approval.approvalReason}</small>}
      <button className="secondary" type="button" disabled={busy || syncState !== "saved"} onClick={revoke}>{ui("revoke")}</button>
    </div>}
    {canApprove && currentApproval.phase === "loaded" && !currentApproval.approved && currentApproval.approvalReason && <small>{ui("expired")}</small>}
    {error && <p role="alert" className="sync-error">{error}</p>}
    {!isAgent && result && <small>{ui("assessment", result.decisionStatus, result.minimumMarginPercent)}</small>}
  </section>;
}
