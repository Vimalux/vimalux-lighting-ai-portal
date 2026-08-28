import { numberValue } from "./calculations.js";
import { defaultProject, migrateProject, uid } from "./model.js";

const n = (value) => Math.max(0, numberValue(value));
const text = (value) => String(value ?? "").trim();

export function opportunityFromSearchParams(searchParams) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  if (params.get("source") !== "crm" || !params.get("opportunity_id")) return null;
  return {
    customer: { municipalityName: text(params.get("customer")), country: "Italia" },
    contact: {},
    source: { source: "VIMALUX CRM" },
    opportunity: {
      opportunityId: text(params.get("opportunity_id")),
      uniqueProjectId: text(params.get("opportunity_id")),
      projectLineageId: text(params.get("project_lineage_id")),
      businessCaseId: text(params.get("business_case_id")),
      projectName: text(params.get("project")) || text(params.get("customer")),
      stage: "lead",
    },
    assumptions: {
      totalLuminaires: n(params.get("luminaires")),
      existingTechnology: text(params.get("existing_technology")),
      averageExistingWatt: n(params.get("existing_watt")),
      annualOperatingHours: n(params.get("operating_hours")),
      energyPrice: n(params.get("energy_price")),
      existingDimmingProfile: text(params.get("dimming_profile")) || "none",
      existingDimmingPct: n(params.get("dimming_pct")),
      existingDriverType: text(params.get("driver_type")),
    },
    commercial: {
      financingModel: text(params.get("financing_model")) || "cash",
      financingPeriodYears: n(params.get("financing_years")),
      serviceAgreementPeriodYears: n(params.get("service_years")),
      analysisPeriodYears: n(params.get("analysis_years")),
    },
  };
}

export function canonicalOpportunityFromProject(project) {
  const groups = project.groups || [];
  const total = groups.reduce((sum, group) => sum + n(group.quantity), 0);
  const weightedWatt = groups.reduce((sum, group) => sum + n(group.quantity) * n(group.existingWattage), 0);
  const technologies = [...new Set(groups.map((group) => text(group.technology)).filter(Boolean))];
  const dimming = groups.find((group) => group.existingDimmingProfile === "fixed") || groups[0] || {};
  const crm = project.crm || {};
  const projectLineageId = crm.projectLineageId || project.project?.projectLineageId || "";
  return {
    customer: {
      customerId: crm.customerId || "",
      municipalityName: project.customer?.name || "",
      province: project.customer?.province || "",
      region: project.customer?.region || "",
      country: project.customer?.country || "Italia",
    },
    contact: {
      contactId: crm.contactId || "",
      name: project.customer?.contact || "",
      title: project.customer?.title || "",
      email: project.customer?.email || "",
      phone: project.customer?.telephone || "",
    },
    source: {
      agentId: crm.agentId || "",
      agentName: crm.agentName || project.project?.consultant || "",
      source: crm.source || "",
    },
    opportunity: {
      opportunityId: crm.opportunityId || project.id,
      uniqueProjectId: crm.uniqueProjectId || crm.opportunityId || project.id,
      projectLineageId,
      projectName: project.project?.name || project.name || "",
      businessCaseId: project.project?.businessCaseId || "",
      createdAt: project.createdAt || "",
      updatedAt: project.updatedAt || "",
      stage: crm.status || "lead",
      probabilityPct: crm.status === "won" ? 100 : n(crm.closingProbability),
      expectedCloseDate: crm.expectedCloseDate || "",
      goStatus: crm.goStatus || crm.businessCase?.goStatus || "",
      notes: crm.notes || "",
    },
    assumptions: {
      totalLuminaires: total,
      existingTechnology: technologies.join(", "),
      averageExistingWatt: total ? weightedWatt / total : 0,
      annualOperatingHours: n(project.assumptions?.operatingHours),
      energyPrice: n(project.assumptions?.energyPrice),
      existingDimmingProfile: dimming.existingDimmingProfile || "none",
      existingDimmingPct: n(dimming.existingDimmingPercent),
      existingDriverType: dimming.existingDriverType || "",
      smartLightingEnabled: Boolean(project.solution?.smartEnabled),
      cmsEnabled: Boolean(project.solution?.cmsEnabled),
      powerAidEnabled: Boolean(project.solution?.powerAidEnabled),
    },
    commercial: {
      financingModel: project.assumptions?.dealType || project.assumptions?.financingModel || "cash",
      financingPeriodYears: n(project.assumptions?.financingPeriod),
      serviceAgreementPeriodYears: n(project.assumptions?.serviceAgreementPeriod),
      analysisPeriodYears: n(project.assumptions?.analysisPeriod),
    },
    businessCase: crm.businessCase || null,
    businessCaseUrl: crm.businessCaseUrl || "",
    plannerProjectUrl: crm.plannerProjectUrl || "",
    importHistory: Array.isArray(crm.importHistory) ? crm.importHistory : [],
  };
}

export function applyOpportunityToProject(opportunity, existingProject = null) {
  const base = existingProject ? migrateProject(existingProject) : defaultProject();
  const now = new Date().toISOString();
  const source = opportunity.source || {};
  const data = opportunity.opportunity || {};
  const assumptions = opportunity.assumptions || {};
  const commercial = opportunity.commercial || {};
  const total = Math.max(0, Math.round(n(assumptions.totalLuminaires)));
  const technology = text(assumptions.existingTechnology).split(",")[0].trim() || "OTHER";
  const group = {
    ...(base.groups?.[0] || {}),
    id: base.groups?.[0]?.id || uid(),
    name: "Imported aggregate",
    quantity: total,
    technology,
    existingWattage: n(assumptions.averageExistingWatt),
    existingDimmingProfile: assumptions.existingDimmingProfile || "none",
    existingDimmingPercent: n(assumptions.existingDimmingPct),
    existingDriverType: assumptions.existingDriverType || "non_dimmable",
  };
  const projectLineageId = data.projectLineageId || base.crm?.projectLineageId || base.project?.projectLineageId || "";
  const project = {
    ...base,
    id: existingProject?.id || data.uniqueProjectId || data.opportunityId || uid(),
    name: data.projectName || opportunity.customer?.municipalityName || base.name,
    createdAt: data.createdAt || base.createdAt,
    updatedAt: now,
    customer: {
      ...base.customer,
      name: opportunity.customer?.municipalityName || base.customer.name,
      province: opportunity.customer?.province || base.customer.province || "",
      region: opportunity.customer?.region || base.customer.region || "",
      country: opportunity.customer?.country || base.customer.country || "Italia",
      contact: opportunity.contact?.name || base.customer.contact || "",
      title: opportunity.contact?.title || base.customer.title || "",
      email: opportunity.contact?.email || base.customer.email || "",
      telephone: opportunity.contact?.phone || base.customer.telephone || "",
    },
    project: {
      ...base.project,
      name: data.projectName || opportunity.customer?.municipalityName || base.project.name,
      businessCaseId: data.businessCaseId || base.project.businessCaseId,
      projectLineageId,
      consultant: source.agentName || base.project.consultant,
    },
    groups: total > 0 ? [group] : base.groups,
    solution: {
      ...base.solution,
      smartEnabled: Boolean(assumptions.smartLightingEnabled),
      cmsEnabled: Boolean(assumptions.smartLightingEnabled && assumptions.cmsEnabled),
      powerAidEnabled: Boolean(assumptions.smartLightingEnabled && assumptions.cmsEnabled && assumptions.powerAidEnabled),
    },
    assumptions: {
      ...base.assumptions,
      operatingHours: n(assumptions.annualOperatingHours) || base.assumptions.operatingHours,
      energyPrice: n(assumptions.energyPrice) || base.assumptions.energyPrice,
      dealType: commercial.financingModel || base.assumptions.dealType,
      financingPeriod: Math.max(1, Math.round(n(commercial.financingPeriodYears) || base.assumptions.financingPeriod)),
      serviceAgreementPeriod: Math.max(1, Math.round(n(commercial.serviceAgreementPeriodYears) || base.assumptions.serviceAgreementPeriod)),
      analysisPeriod: Math.max(1, Math.round(n(commercial.analysisPeriodYears) || base.assumptions.analysisPeriod)),
    },
    crm: {
      ...base.crm,
      projectLineageId,
      customerId: opportunity.customer?.customerId || base.crm?.customerId || "",
      contactId: opportunity.contact?.contactId || base.crm?.contactId || "",
      agentId: source.agentId || base.crm?.agentId || "",
      agentName: source.agentName || base.crm?.agentName || "",
      source: source.source || base.crm?.source || "",
      opportunityId: data.opportunityId || data.uniqueProjectId || base.crm?.opportunityId || base.id,
      uniqueProjectId: data.uniqueProjectId || data.opportunityId || base.crm?.uniqueProjectId || base.id,
      status: data.stage || base.crm?.status || "lead",
      closingProbability: data.stage === "won" ? 100 : Math.min(100, n(data.probabilityPct)),
      expectedCloseDate: data.expectedCloseDate || "",
      goStatus: data.goStatus || base.crm?.goStatus || "",
      notes: data.notes || "",
      businessCaseUrl: opportunity.businessCaseUrl || base.crm?.businessCaseUrl || "",
      plannerProjectUrl: opportunity.plannerProjectUrl || base.crm?.plannerProjectUrl || "",
      businessCase: opportunity.businessCase || base.crm?.businessCase || null,
      importHistory: opportunity.importHistory || base.crm?.importHistory || [],
    },
  };
  project.assumptions.financingYears = project.assumptions.financingPeriod;
  project.assumptions.contractYears = project.assumptions.serviceAgreementPeriod;
  if (opportunity.legacyCommercial) {
    project.assumptions.officialOfferCapex = n(opportunity.legacyCommercial.capex);
    project.assumptions.officialAnnualOpex = n(opportunity.legacyCommercial.annualOpex);
    project.assumptions.allInclusiveAnnualPayment = n(opportunity.legacyCommercial.allInclusiveAnnualPayment);
    project.assumptions.interestRate = n(opportunity.legacyCommercial.interestRate);
    project.importedCommercial = opportunity.legacyCommercial;
  }
  return migrateProject(project);
}

export function mergeOpportunity(projects, opportunity) {
  const key = opportunity.opportunity?.uniqueProjectId || opportunity.opportunity?.opportunityId || opportunity.opportunity?.businessCaseId;
  const existing = key ? projects.find((project) => [project.crm?.uniqueProjectId, project.crm?.opportunityId, project.id, project.project?.businessCaseId].includes(key)) : null;
  const municipality = text(opportunity.customer?.municipalityName).toLowerCase();
  const customerMatch = !existing && municipality ? projects.find((project) => text(project.customer?.name).toLowerCase() === municipality) : null;
  let base = existing || null;
  if (!base && customerMatch) {
    base = defaultProject();
    base.customer = { ...base.customer, ...customerMatch.customer, ...Object.fromEntries(Object.entries(opportunity.contact || {}).filter(([, value]) => text(value))) };
    base.crm.customerId = customerMatch.crm?.customerId || customerMatch.id;
    base.crm.contactId = opportunity.contact?.contactId || customerMatch.crm?.contactId || "";
  }
  const imported = applyOpportunityToProject(opportunity, base);
  if (!existing && base) imported.id = opportunity.opportunity?.uniqueProjectId || opportunity.opportunity?.opportunityId || uid();
  return {
    projects: existing ? projects.map((project) => project.id === existing.id ? imported : project) : [...projects, imported],
    project: imported,
    action: existing ? "updated" : "created",
  };
}

export function canCreatePlannerProject(project) {
  return project.crm?.goStatus === "GO" && Boolean(project.crm?.businessCase?.calculatedAt);
}

export function buildPlannerHandoff(project) {
  if (!canCreatePlannerProject(project)) throw new Error("Planner handoff requires GO and a calculated Preliminary Business Case.");
  const canonical = canonicalOpportunityFromProject(project);
  return {
    schemaVersion: 1,
    status: "ready",
    createdAt: new Date().toISOString(),
    projectLineageId: canonical.opportunity.projectLineageId,
    customer: canonical.customer,
    project: {
      projectLineageId: canonical.opportunity.projectLineageId,
      opportunityId: canonical.opportunity.opportunityId,
      businessCaseId: canonical.opportunity.businessCaseId,
      projectName: canonical.opportunity.projectName,
    },
    preliminaryBusinessCase: canonical.businessCase,
    preliminaryAggregateAssumptions: canonical.assumptions,
    commercialStructure: canonical.commercial,
    selectedConcept: {
      smartLightingEnabled: canonical.assumptions.smartLightingEnabled,
      cmsEnabled: canonical.assumptions.cmsEnabled,
      powerAidEnabled: canonical.assumptions.powerAidEnabled,
    },
  };
}
