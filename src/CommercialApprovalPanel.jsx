import React, { useEffect, useState } from "react";
import { isStableCloudId } from "./businessCasePersistence.js";
import { stagingPreview, supabase } from "./supabase.js";
import { commercialReleaseLabel, commercialReleaseState, isFinalCommercialOfferAuthorized } from "./commercialApproval.js";

const message = (it, english, italian) => it ? italian : english;

export default function CommercialApprovalPanel({ project, result, isAgent = false, canApprove = false, syncState = "saved" }) {
  const it = project.language === "it";
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
    } catch (cause) { setError(cause.message || "Approval failed"); }
    finally { setBusy(false); }
  };

  const revoke = async () => {
    if (busy || !canApprove || !isCloudCase) return;
    setBusy(true); setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("revoke_intelligence_commercial_exception", { case_id: caseId });
      if (rpcError) throw rpcError;
      setApproval({ phase: "loaded", fetchedUpdatedAt: project.updatedAt, ...(data || {}) });
    } catch (cause) { setError(cause.message || "Revocation failed"); }
    finally { setBusy(false); }
  };

  return <section className={`commercial-approval ${allowed ? "authorized" : "pending"}`} data-commercial-release={state}>
    <div className="commercial-approval-head">
      <strong>{message(it, "Commercial approval — final offer", "Autorizzazione commerciale — offerta definitiva")}</strong>
      <span role="status">{commercialReleaseLabel(state, project.language)}</span>
    </div>
    <p>{message(it,
      "You may share the non-binding preliminary study/proposal with the client. A final, binding quotation must only be issued when VIMALUX has authorized it.",
      "Puoi condividere con il cliente lo studio o la proposta preliminare non vincolante. L'offerta commerciale definitiva può essere emessa solo dopo l'autorizzazione VIMALUX.")}</p>
    {isAgent && !allowed && <small>{message(it,
      "If the client requests a binding offer, request commercial approval from VIMALUX Admin. The preliminary proposal can still be shared today.",
      "Se il cliente richiede un'offerta vincolante, chiedi l'autorizzazione commerciale a VIMALUX Admin. La proposta preliminare può comunque essere condivisa ora.")}</small>}
    {canApprove && isApprovalCandidate && !currentApproval.approved && <div className="commercial-approval-actions">
      <p>{message(it, "To release a final offer to an Agent, an Admin must explicitly approve this saved project version — including when the policy margin is met.", "Per autorizzare l'agente a emettere un'offerta definitiva, l'Admin deve approvare espressamente questa versione salvata — anche quando il margine minimo è rispettato.")}</p>
      <label>{message(it, "Admin justification for commercial release (required)", "Motivazione Admin per autorizzazione commerciale (obbligatoria)")}
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} placeholder={message(it, "Reason, commercial terms and conditions", "Motivazione, termini e condizioni commerciali")} />
      </label>
      <button className="secondary" type="button" disabled={busy || reason.trim().length < 12 || syncState !== "saved" || currentApproval.phase !== "loaded"} onClick={approve}>
        {message(it, "Authorize final offer for Agent", "Autorizza offerta definitiva per l'agente")}
      </button>
    </div>}
    {canApprove && currentApproval.phase === "loaded" && currentApproval.approved && <div className="commercial-approval-actions">
      {approval.approvalReason && <small>{message(it, "Admin reason: ", "Motivazione Admin: ")}{approval.approvalReason}</small>}
      <button className="secondary" type="button" disabled={busy || syncState !== "saved"} onClick={revoke}>{message(it, "Revoke authorization", "Revoca autorizzazione")}</button>
    </div>}
    {canApprove && currentApproval.phase === "loaded" && !currentApproval.approved && currentApproval.approvalReason && <small>{message(it, "Previous approval expired after a project update. A new approval is required.", "L'approvazione precedente è decaduta dopo una modifica del progetto. Serve una nuova approvazione.")}</small>}
    {error && <p role="alert" className="sync-error">{error}</p>}
    {!isAgent && result && <small>{message(it, `Internal assessment: ${result.decisionStatus}; minimum project margin: ${result.minimumMarginPercent}%.`, `Valutazione interna: ${result.decisionStatus}; margine minimo di progetto: ${result.minimumMarginPercent}%.`)}</small>}
  </section>;
}
