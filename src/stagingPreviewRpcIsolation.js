// Non-authenticated Vercel previews use browser-local Business Cases and their
// stored catalogues. Do not query restricted staging RPCs with the anon key.
// Return null when an RPC is not covered, so the real client remains in charge.
export function stagingPreviewRpcResponse(name, projectRows = []) {
  const ok = (data, count = null) => ({ data, error: null, count, status: 200, statusText: "OK" });
  switch (name) {
    case "list_business_cases_v2":
      return ok(projectRows);
    case "list_archived_business_cases_v2":
      return ok([], 0);
    case "get_intelligence_catalogue":
      // A null catalogue retains the catalogue saved in the active local project.
      // Returning an empty catalogue would incorrectly discard product choices.
      return ok(null);
    case "get_proposal_history":
      return ok([], 0);
    case "publish_intelligence_preliminary_proposal":
      return ok({ preview: true });
    default:
      return null;
  }
}
