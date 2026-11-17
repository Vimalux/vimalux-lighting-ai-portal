// Separate the municipality's financial feasibility from VIMALUX's authority to
// issue a final, binding commercial offer. Preliminary documents are unaffected.
export function commercialReleaseState(result, approval = {}, syncState = "saved", isAgent = false) {
  if (result?.customerDecisionStatus !== "GO") return "customer_review";
  // The Agent receives a sanitized project without protected supplier costs and
  // commissions. Their locally computed internal GO can NEVER authorize an offer.
  // Only an admin-authored, server-version-bound record can release an Agent.
  if (isAgent) {
    if (syncState !== "saved") return "pending_sync";
    if (approval?.phase === "error" || approval?.phase === "unavailable") return "unverified";
    return approval?.phase === "loaded" && approval.approved === true ? "approved_by_vimalux" : "pending_admin";
  }
  if (result?.decisionStatus === "NO_GO") return "blocked";
  if (result?.decisionStatus === "GO") return "approved_by_policy";
  if (syncState !== "saved") return "pending_sync";
  if (approval?.phase === "error" || approval?.phase === "unavailable") return "unverified";
  if (result?.decisionStatus === "REVIEW" && approval?.phase === "loaded" && approval?.approved === true) return "approved_exception";
  return "pending_admin";
}

export function commercialReleaseLabel(state, lang = "it") {
  const labels = {
    it: {
      customer_review: "Valutazione cliente da rivedere",
      blocked: "Offerta definitiva bloccata — progetto da rivedere",
      approved_by_policy: "Offerta definitiva autorizzabile secondo i criteri VIMALUX",
      pending_sync: "In attesa del salvataggio del progetto",
      unverified: "Autorizzazione non verificabile — offerta definitiva non autorizzata",
      approved_exception: "Eccezione commerciale approvata da VIMALUX",
      approved_by_vimalux: "Offerta definitiva autorizzata da VIMALUX",
      pending_admin: "In attesa di approvazione commerciale VIMALUX",
    },
    en: {
      customer_review: "Customer feasibility must be reviewed",
      blocked: "Final offer blocked — revise the project",
      approved_by_policy: "Final offer eligible under VIMALUX policy",
      pending_sync: "Waiting for project synchronization",
      unverified: "Approval unavailable — final offer not authorized",
      approved_exception: "Commercial exception approved by VIMALUX",
      approved_by_vimalux: "Final offer authorized by VIMALUX",
      pending_admin: "Awaiting VIMALUX commercial approval",
    },
    da: {
      customer_review: "Kundecase kræver gennemgang",
      blocked: "Endeligt tilbud blokeret — projektet skal rettes",
      approved_by_policy: "Endeligt tilbud opfylder VIMALUX' krav",
      pending_sync: "Afventer synkronisering af projektet",
      unverified: "Godkendelse kunne ikke kontrolleres — endeligt tilbud ikke frigivet",
      approved_exception: "Kommerciel undtagelse godkendt af VIMALUX",
      approved_by_vimalux: "Endeligt tilbud frigivet af VIMALUX",
      pending_admin: "Afventer VIMALUX' kommercielle godkendelse",
    },
  };
  return (labels[lang] || labels.it)[state] || (labels[lang] || labels.it).pending_admin;
}

export function isFinalCommercialOfferAuthorized(state) {
  return state === "approved_by_policy" || state === "approved_exception" || state === "approved_by_vimalux";
}
