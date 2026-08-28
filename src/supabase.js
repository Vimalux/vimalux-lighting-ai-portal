import { createClient } from "@supabase/supabase-js";
import { projectFromBusinessCaseRow } from "./businessCaseTransport.js";
import { isStableCloudId, persistIntelligenceProject } from "./businessCasePersistence.js";
import {
  createOrGetBusinessCaseForOpportunity,
  lookupBusinessCaseForOpportunity,
} from "./crmBusinessCase.js";

const url = import.meta.env.VITE_SHARED_SUPABASE_URL || "https://ymzdjjpvuvhxxzsffqik.supabase.co";
const key = import.meta.env.VITE_SHARED_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ma_iqpL_aHaoxQSsGs8TeA_p_MGg695";

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      db: { schema: "public" },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

async function getCurrentProfile(fields = "id,email,full_name,role") {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.id) return null;
  const { data, error } = await supabase.from("profiles").select(fields).eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadCloudState(localProjects, includeLocalProjects = true) {
  const [{ data: projectRows, error: projectError }, { data: catalogue, error: catalogueError }] = await Promise.all([
    supabase.rpc("list_business_cases_v2"),
    supabase.rpc("get_intelligence_catalogue"),
  ]);
  if (projectError) throw projectError;
  if (catalogueError) throw catalogueError;
  const masterCatalogue = catalogue ? { led: catalogue.led || [], smart: catalogue.smart || [] } : null;
  const cloudProjects = (projectRows || []).map((row) => {
    const project = projectFromBusinessCaseRow(row);
    return masterCatalogue ? { ...project, catalogue: masterCatalogue } : project;
  });
  if (!includeLocalProjects) return cloudProjects;
  const pendingImports = (localProjects || []).filter((item) =>
    !isStableCloudId(item?.id) &&
    (item?.importedTechnical || item?.importedCommercial) &&
    !cloudProjects.some((cloud) => cloud.id === item.id)
  );
  return [...cloudProjects, ...pendingImports.map((item) => masterCatalogue ? { ...item, catalogue: masterCatalogue } : item)];
}

export async function saveCloudState(projects) {
  if (!projects.length) return [];
  const promotions = [];
  const catalogue = projects[0].catalogue;
  const profile = await getCurrentProfile("id,role");
  if (["admin", "vimalux", "sales_manager"].includes(profile?.role)) {
    const { error: catalogueError } = await supabase.rpc("save_intelligence_catalogue", { catalogue_payload: catalogue });
    if (catalogueError) throw catalogueError;
  }
  for (const project of projects) {
    const persisted = await persistIntelligenceProject(supabase, project, profile);
    if (persisted?.promotion) promotions.push(persisted.promotion);
  }
  return promotions;
}

export async function deleteCloudProject(projectId) {
  const { error } = await supabase.rpc("delete_business_case", { case_id: projectId });
  if (error) throw error;
}

export async function loadBusinessCase(caseId) {
  const { data, error } = await supabase.rpc("get_business_case_v2", { case_id: caseId });
  if (error) throw error;
  return data?.[0] ? projectFromBusinessCaseRow(data[0]) : null;
}

export async function getLinkedBusinessCaseId(opportunityId) {
  return lookupBusinessCaseForOpportunity(supabase, opportunityId);
}

export async function createOrOpenBusinessCase(opportunityId) {
  return createOrGetBusinessCaseForOpportunity(supabase, opportunityId);
}

export async function publishPreliminaryProposal(caseId, options = {}) {
  const { data, error } = await supabase.rpc("publish_intelligence_preliminary_proposal", {
    case_id: caseId,
    quotation_id: options.quotationId || null,
    proposal_status: options.status || "draft",
    pdf_reference: options.pdfReference || null,
    savings_report_reference: options.savingsReportReference || null,
  });
  if (error) throw error;
  return data;
}

export async function loadCurrentProfile() {
  return getCurrentProfile();
}
