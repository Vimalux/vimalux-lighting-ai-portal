import { calculateBusinessCase } from "./calculations.js";
import { buildBusinessCaseSnapshot } from "./businessCaseSync.js";

const stableUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isStableCloudId(value) {
  return stableUuid.test(String(value || ""));
}

export async function persistIntelligenceProject(client, project, profile) {
  const canCreateLinkedCase = ["admin", "vimalux", "sales_manager", "agent"].includes(profile?.role);
  if (
    profile?.role === "agent" &&
    isStableCloudId(project?.id) &&
    String(project?.crm?.agentId || "") !== String(profile?.id || "")
  ) return null;

  const result = calculateBusinessCase(project);
  const calculatedAt = project.updatedAt || new Date().toISOString();
  const businessCase = buildBusinessCaseSnapshot(project, calculatedAt);
  const probability = project.crm?.status === "won" ? 100 : Math.min(100, Math.max(0, Number(project.crm?.closingProbability) || 0));
  const commercialSnapshot = {
    schemaVersion: 1,
    calculatedAt,
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
    co2ReductionTons: result.co2ReductionKg / 1000,
  };
  let payload = { ...project, crm: { ...(project.crm || {}), goStatus: businessCase.goStatus, businessCase }, commercialSnapshot };
  let caseId = project.crm?.businessCaseRecordId || project.id;
  let crmOpportunityId = project.crm?.opportunityId || "";
  const promotion = { legacyId: project.id };

  if (!isStableCloudId(caseId)) {
    if (!canCreateLinkedCase) return null;
    if (project.importedTechnical || project.importedCommercial) {
      const createdDraft = await client.rpc("create_intelligence_draft", { legacy_id: project.id, project_payload: payload });
      if (createdDraft.error) throw createdDraft.error;
      caseId = createdDraft.data;
    } else {
      if (!String(project.customer?.name || "").trim() || !String(project.project?.name || "").trim()) return null;
      const created = await client.rpc("create_internal_business_case", { legacy_id: project.id, project_payload: payload });
      if (created.error) throw created.error;
      caseId = created.data;
    }
    promotion.caseId = caseId;
  }

  if (
    isStableCloudId(caseId) &&
    !String(crmOpportunityId || "").trim() &&
    String(project.customer?.name || "").trim() &&
    String(project.project?.name || "").trim()
  ) {
    const promoted = await client.rpc("promote_intelligence_draft", {
      case_id: caseId,
      project_payload: { ...payload, crm: { ...(payload.crm || {}), status: "lead" } },
    });
    if (promoted.error) throw promoted.error;
    crmOpportunityId = promoted.data || crmOpportunityId;
    if (crmOpportunityId) {
      payload = {
        ...payload,
        crm: { ...(payload.crm || {}), opportunityId: crmOpportunityId, uniqueProjectId: crmOpportunityId, status: "lead" },
      };
      promotion.crmOpportunityId = crmOpportunityId;
    }
  }

  const saved = await client.rpc("save_business_case_intelligence", {
    case_id: caseId,
    project_payload: payload,
    calculated_result: businessCase,
  });
  if (saved.error) throw saved.error;
  return { caseId, crmOpportunityId, promotion: promotion.caseId || promotion.crmOpportunityId ? promotion : null };
}
