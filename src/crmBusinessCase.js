import { businessCaseOpenUrl } from "./businessCaseTransport.js";

const stableUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireStableId(value, label) {
  const id = String(value || "").trim();
  if (!stableUuid.test(id)) throw new Error(`${label} is missing or invalid.`);
  return id;
}

function rpcValue(response, action) {
  if (response?.error) throw response.error;
  if (response?.data == null || response.data === "") return null;
  return requireStableId(response.data, `${action} returned an invalid Business Case ID`);
}

export function existingBusinessCaseRecordId(project) {
  const id = String(project?.crm?.businessCaseRecordId || "").trim();
  return stableUuid.test(id) ? id : "";
}

export async function lookupBusinessCaseForOpportunity(client, opportunityId) {
  if (!client?.rpc) throw new Error("Supabase connection is unavailable.");
  const stableOpportunityId = requireStableId(opportunityId, "CRM Opportunity ID");
  const response = await client.rpc("get_business_case_id_for_opportunity", {
    opportunity_id: stableOpportunityId,
  });
  return rpcValue(response, "Business Case lookup") || "";
}

export async function createOrGetBusinessCaseForOpportunity(client, opportunityId) {
  if (!client?.rpc) throw new Error("Supabase connection is unavailable.");
  const stableOpportunityId = requireStableId(opportunityId, "CRM Opportunity ID");
  const response = await client.rpc("create_or_get_business_case", {
    opportunity_id: stableOpportunityId,
  });
  return rpcValue(response, "Business Case creation");
}

export function businessCaseActionLabel(linked, language = "en") {
  const labels = {
    da: linked ? "Åbn Business Case" : "Opret Business Case i Intelligence",
    it: linked ? "Apri Business Case" : "Crea Business Case in Intelligence",
    en: linked ? "Open Business Case" : "Create Business Case in Intelligence",
  };
  return labels[language] || labels.en;
}

export function linkedBusinessCaseUrl(caseId, origin) {
  return businessCaseOpenUrl(requireStableId(caseId, "Business Case ID"), origin);
}
