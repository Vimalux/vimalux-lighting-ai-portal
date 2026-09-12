import { createClient } from "@supabase/supabase-js";
import { projectFromBusinessCaseRow } from "./businessCaseTransport.js";
import { isStableCloudId, persistIntelligenceProject } from "./businessCasePersistence.js";
import { activeIntelligenceProjects, isArchivedProject } from "./projectVisibility.js";
import { dedupeProjects, isSameImportedProject } from "./projectDeduplication.js";
import {
  createOrGetBusinessCaseForOpportunity,
  lookupBusinessCaseForOpportunity,
} from "./crmBusinessCase.js";

const productionHost = typeof window !== "undefined" && window.location.hostname === "app.vimalux.com";
export const stagingPreview = !productionHost;

const productionUrl = import.meta.env.VITE_SHARED_SUPABASE_URL || "https://ymzdjjpvuvhxxzsffqik.supabase.co";
const productionKey = import.meta.env.VITE_SHARED_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ma_iqpL_aHaoxQSsGs8TeA_p_MGg695";
const stagingUrl = "https://jjmfvxbfljixdqyibeza.supabase.co";
const stagingKey = "sb_publishable_o8WIR8kuQ86vY1NjqdA3gQ_pslhpaHM";

const url = stagingPreview ? stagingUrl : productionUrl;
const key = stagingPreview ? stagingKey : productionKey;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      db: { schema: "public" },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

export async function loadStagingCatalogue() {
  if (!stagingPreview || !supabase) return null;
  const { data, error } = await supabase.rpc("get_intelligence_catalogue");
  if (error) throw error;
  return data ? { led: data.led || [], smart: data.smart || [] } : null;
}

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
  const cloudProjects = dedupeProjects(activeIntelligenceProjects((projectRows || []).map((row) => {
    const project = projectFromBusinessCaseRow(row);
    return masterCatalogue ? { ...project, catalogue: masterCatalogue } : project;
  })));
  if (!includeLocalProjects) return cloudProjects;
  const pendingImports = (localProjects || []).filter((item) =>
    !isArchivedProject(item) &&
    !isStableCloudId(item?.id) &&
    (item?.importedTechnical || item?.importedCommercial) &&
    !cloudProjects.some((cloud) => cloud.id === item.id || isSameImportedProject(cloud, item))
  );
  return dedupeProjects([
    ...cloudProjects,
    ...pendingImports.map((item) => masterCatalogue ? { ...item, catalogue: masterCatalogue } : item),
  ]);
}

export async function saveCloudState(projects) {
  if (stagingPreview) return [];
  const uniqueProjects = dedupeProjects(projects);
  if (!uniqueProjects.length) return [];
  const promotions = [];
  const catalogue = uniqueProjects[0].catalogue;
  const profile = await getCurrentProfile("id,role");
  if (["admin", "vimalux", "sales_manager"].includes(profile?.role)) {
    const { error: catalogueError } = await supabase.rpc("save_intelligence_catalogue", { catalogue_payload: catalogue });
    if (catalogueError) throw catalogueError;
  }
  for (const project of uniqueProjects) {
    const persisted = await persistIntelligenceProject(supabase, project, profile);
    if (persisted?.promotion) promotions.push(persisted.promotion);
  }
  return promotions;
}

export async function deleteCloudProject(projectId) {
  if (stagingPreview) throw new Error("Deletion is disabled in staging preview.");
  const { error } = await supabase.rpc("delete_business_case", { case_id: projectId });
  if (error) throw error;
}

export async function loadBusinessCase(caseId) {
  const { data, error } = await supabase.rpc("get_business_case_v2", { case_id: caseId });
  if (error) throw error;
  if (!data?.[0]) return null;
  const project = projectFromBusinessCaseRow(data[0]);
  return isArchivedProject(project) ? null : project;
}

export async function getLinkedBusinessCaseId(opportunityId) {
  return lookupBusinessCaseForOpportunity(supabase, opportunityId);
}

export async function createOrOpenBusinessCase(opportunityId) {
  return createOrGetBusinessCaseForOpportunity(supabase, opportunityId);
}

export async function publishPreliminaryProposal(caseId, options = {}) {
  if (stagingPreview) throw new Error("Publishing is disabled in staging preview.");
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
  if (stagingPreview) return { id: "staging-preview", role: "admin", email: "staging@vimalux.local", full_name: "Staging Preview" };
  return getCurrentProfile();
}
