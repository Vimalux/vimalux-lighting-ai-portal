import { createClient } from "@supabase/supabase-js";
import { mergeProjectStates } from "./projectSync.js";
import { calculateBusinessCase } from "./calculations.js";
import { deleteProjectRow } from "./cloudProjects.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function loadCloudState(localProjects, includeLocalProjects = true) {
  const [{ data: projectRows, error: projectError }, { data: catalogue, error: catalogueError }] = await Promise.all([
    supabase.from("intelligence_projects").select("id,data,updated_at").order("updated_at", { ascending: true }),
    supabase.from("intelligence_catalogue").select("led,smart").eq("id", "master").maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (catalogueError) throw catalogueError;
  if (!projectRows?.length) {
    await saveCloudState(localProjects);
    return localProjects;
  }
  const masterCatalogue = catalogue ? { led: catalogue.led || [], smart: catalogue.smart || [] } : null;
  const cloudProjects = projectRows.map((row) => ({ ...row.data, id: row.id, updatedAt: row.data?.updatedAt || row.updated_at, ...(masterCatalogue ? { catalogue: masterCatalogue } : {}) }));
  return mergeProjectStates(includeLocalProjects ? localProjects : [], cloudProjects).map((project) => masterCatalogue ? { ...project, catalogue: masterCatalogue } : project);
}

export async function saveCloudState(projects) {
  if (!projects.length) return;
  const catalogue = projects[0].catalogue;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;
  const { error: catalogueError } = await supabase.from("intelligence_catalogue").upsert({ id: "master", led: catalogue.led, smart: catalogue.smart, updated_by: userId });
  if (catalogueError) throw catalogueError;
  const rows = projects.map((project) => {
    const result = calculateBusinessCase(project);
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
    return { id: project.id, data: { ...project, commercialSnapshot }, updated_by: userId };
  });
  const { error: projectsError } = await supabase.from("intelligence_projects").upsert(rows);
  if (projectsError) throw projectsError;
}

export async function deleteCloudProject(projectId) {
  return deleteProjectRow(supabase, projectId);
}
