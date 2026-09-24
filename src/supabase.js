import { createClient } from "@supabase/supabase-js";
import { projectFromBusinessCaseRow } from "./businessCaseTransport.js";
import { isStableCloudId, persistIntelligenceProject } from "./businessCasePersistence.js";
import { activeIntelligenceProjects, isArchivedProject } from "./projectVisibility.js";
import { dedupeProjects, isSameImportedProject } from "./projectDeduplication.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";
import { catalogueForMasterSave, catalogueWithHistoricalSelections } from "./catalogueIntegrity.js";
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

export function normalizePreviewRpcName(name, preview = stagingPreview) {
  return preview && name === "list_business_cases" ? "list_business_cases_v2" : name;
}

function previewBusinessCaseRows() {
  try {
    const stored = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    const projects = Array.isArray(stored) ? stored : [];
    return projects.map((project) => {
      const snapshot = buildBusinessCaseSnapshot(project, project.updatedAt || project.createdAt || new Date().toISOString());
      return {
        id: project?.crm?.businessCaseRecordId || project?.id,
        business_case_code: project?.project?.businessCaseId || snapshot.businessCaseId || "",
        project_lineage_id: project?.crm?.projectLineageId || project?.project?.projectLineageId || "",
        crm_opportunity_id: project?.crm?.opportunityId || project?.crm?.uniqueProjectId || "staging-preview",
        intelligence_data: project,
        result_summary: snapshot,
        crm_fields: {
          customer: project?.customer?.name || "",
          project: project?.project?.name || project?.name || "",
        },
      };
    });
  } catch {
    return [];
  }
}

// Staging preview is intentionally self-contained: customer proposal generation must
// use the active locally stored Business Case and must not depend on staging RPC grants.
// Production behavior is intentionally untouched.
if (stagingPreview && supabase?.rpc && !supabase.__vimaluxPreviewRpcIsolationInstalled) {
  const originalRpc = supabase.rpc.bind(supabase);
  supabase.rpc = (name, args, options) => {
    const normalized = normalizePreviewRpcName(name, true);
    if (normalized === "list_business_cases_v2") {
      return Promise.resolve({ data: previewBusinessCaseRows(), error: null, count: null, status: 200, statusText: "OK" });
    }
    if (normalized === "get_proposal_history") {
      return Promise.resolve({ data: [], error: null, count: 0, status: 200, statusText: "OK" });
    }
    if (normalized === "publish_intelligence_preliminary_proposal") {
      return Promise.resolve({ data: { preview: true }, error: null, count: null, status: 200, statusText: "OK" });
    }
    return originalRpc(normalized, args, options);
  };
  supabase.__vimaluxPreviewRpcIsolationInstalled = true;
}

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
    return masterCatalogue ? { ...project, catalogue: catalogueWithHistoricalSelections(project, masterCatalogue) } : project;
  })));
  if (!includeLocalProjects) return cloudProjects;

  // Never silently discard a browser-local project that has not yet received a
  // stable cloud UUID. This includes manually created drafts as well as imports.
  // Once cloud persistence succeeds the promotion replaces the local ID with the
  // stable Business Case ID, so the draft naturally drops out of this carry-over.
  const pendingLocalProjects = (localProjects || []).filter((item) =>
    !isArchivedProject(item) &&
    !isStableCloudId(item?.id) &&
    !cloudProjects.some((cloud) => cloud.id === item.id || isSameImportedProject(cloud, item))
  );
  return dedupeProjects([
    ...cloudProjects,
    ...pendingLocalProjects.map((item) => masterCatalogue ? { ...item, catalogue: catalogueWithHistoricalSelections(item, masterCatalogue) } : item),
  ]);
}

export async function saveCloudState(projects) {
  if (stagingPreview) return [];
  const uniqueProjects = dedupeProjects(projects);
  if (!uniqueProjects.length) return [];
  const promotions = [];
  const catalogue = catalogueForMasterSave(uniqueProjects[0].catalogue || {});
  const profile = await getCurrentProfile("id,role");
  if (["admin", "vimalux", "sales_manager"].includes(profile?.role)) {
    const { error: catalogueError } = await supabase.rpc("save_intelligence_catalogue", { catalogue_payload: catalogue });
    if (catalogueError) throw catalogueError;
  }

  // New/unsynced projects are saved first so a manual project gets a durable
  // Business Case draft before the slower portfolio-wide synchronization runs.
  const saveOrder = [...uniqueProjects].sort((a, b) => Number(isStableCloudId(a?.id)) - Number(isStableCloudId(b?.id)));
  for (const project of saveOrder) {
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
  const [{ data, error }, { data: catalogue, error: catalogueError }] = await Promise.all([
    supabase.rpc("get_business_case_v2", { case_id: caseId }),
    supabase.rpc("get_intelligence_catalogue"),
  ]);
  if (error) throw error;
  if (catalogueError) throw catalogueError;
  if (!data?.[0]) return null;
  const project = projectFromBusinessCaseRow(data[0]);
  if (isArchivedProject(project)) return null;
  const masterCatalogue = catalogue ? { led: catalogue.led || [], smart: catalogue.smart || [] } : null;
  return masterCatalogue ? { ...project, catalogue: catalogueWithHistoricalSelections(project, masterCatalogue) } : project;
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
