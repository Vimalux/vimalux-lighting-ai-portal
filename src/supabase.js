import { createClient } from "@supabase/supabase-js";
import { calculateBusinessCase } from "./calculations.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";
import { projectFromBusinessCaseRow } from "./businessCaseTransport.js";

const url = import.meta.env.VITE_SHARED_SUPABASE_URL || "https://ymzdjjpvuvhxxzsffqik.supabase.co";
const key = import.meta.env.VITE_SHARED_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ma_iqpL_aHaoxQSsGs8TeA_p_MGg695";

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

const stableUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    !stableUuid.test(String(item?.id || "")) &&
    (item?.importedTechnical || item?.importedCommercial) &&
    !cloudProjects.some((cloud) => cloud.id === item.id)
  );
  return [...cloudProjects, ...pendingImports.map((item) => masterCatalogue ? { ...item, catalogue: masterCatalogue } : item)];
}

export async function saveCloudState(projects) {
  if (!projects.length) return [];
  const promotions = [];
  const catalogue = projects[0].catalogue;
  const profile = await getCurrentProfile("role");
  if (["admin", "vimalux", "sales_manager"].includes(profile?.role)) {
    const { error: catalogueError } = await supabase.rpc("save_intelligence_catalogue", { catalogue_payload: catalogue });
    if (catalogueError) throw catalogueError;
  }
  const canCreateLinkedCase = ["admin", "vimalux", "sales_manager", "agent"].includes(profile?.role);
  for (const project of projects) {
    const result = calculateBusinessCase(project);
    const businessCase = buildBusinessCaseSnapshot(project, project.updatedAt || new Date().toISOString());
    const probability = project.crm?.status === "won" ? 100 : Math.min(100, Math.max(0, Number(project.crm?.closingProbability) || 0));
    const commercialSnapshot = {
      schemaVersion: 1,
      calculatedAt: project.updatedAt || new Date().toISOString(),
      dealType: result.dealType,
      offerCapex: result.totalCapex,
      annualRecurringRevenue: result.annualRecurringRevenue,
      totalContractRevenue: result.totalContractRevenue,
      weightedContractRevenue: result.totalContractRevenue * probability / 100,
      customerAnnualPayment: result.customerAnnualPayment,
      customerMonthlyPayment: result.customerMonthlyPayment,
      financingAnnualPayment: result.financingAnnualPayment,
      financingMonthlyPayment: result.financingMonthlyPayment,
      allInclusiveAnnualPayment: result.allInclusiveAnnualPayment,
      contractYears: Math.max(1, Math.round(Number(project.assumptions.contractYears) || 1)),
      financingYears: result.financingYears,
      interestRate: Number(project.assumptions.interestRate) || 0,
      interestRateSnapshot: project.assumptions.interestRateSnapshot || null,
      luminaires: result.totalQuantity,
      lcus: result.lcuQuantity,
      cmsAnnualRevenue: result.cmsRevenue,
      gatewayAnnualRevenue: result.gatewayRecurringRevenue,
      powerAidAnnualRevenue: result.savingsAsAServiceRevenue,
      co2ReductionTons: result.co2ReductionKg / 1000
    };
    let payload = { ...project, crm: { ...(project.crm || {}), goStatus: businessCase.goStatus, businessCase }, commercialSnapshot };
    let caseId = project.crm?.businessCaseRecordId || project.id;
    let crmOpportunityId = project.crm?.opportunityId || "";

    if (!stableUuid.test(String(caseId || ""))) {
      if (!canCreateLinkedCase) continue;
      if (project.importedTechnical || project.importedCommercial) {
        const createdDraft = await supabase.rpc("create_intelligence_draft", {
          legacy_id: project.id,
          project_payload: payload,
        });
        if (createdDraft.error) throw createdDraft.error;
        caseId = createdDraft.data;
        promotions.push({ legacyId: project.id, caseId });
      } else {
        if (!String(project.customer?.name || "").trim() || !String(project.project?.name || "").trim()) continue;
        const created = await supabase.rpc("create_internal_business_case", { legacy_id: project.id, project_payload: payload });
        if (created.error) throw created.error;
        caseId = created.data;
        promotions.push({ legacyId: project.id, caseId });
      }
    }

    if (
      stableUuid.test(String(caseId || "")) &&
      !String(crmOpportunityId || "").trim() &&
      String(project.customer?.name || "").trim() &&
      String(project.project?.name || "").trim()
    ) {
      const promoted = await supabase.rpc("promote_intelligence_draft", {
        case_id: caseId,
        project_payload: { ...payload, crm: { ...(payload.crm || {}), status: "lead" } },
      });
      if (promoted.error) throw promoted.error;
      crmOpportunityId = promoted.data || crmOpportunityId;
      if (crmOpportunityId) {
        payload = {
          ...payload,
          crm: {
            ...(payload.crm || {}),
            opportunityId: crmOpportunityId,
            uniqueProjectId: crmOpportunityId,
            status: "lead",
          },
        };
        promotions.push({ legacyId: project.id, caseId, crmOpportunityId });
      }
    }

    const { error } = await supabase.rpc("save_business_case_intelligence", { case_id: caseId, project_payload: payload, calculated_result: businessCase });
    if (error) throw error;
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
