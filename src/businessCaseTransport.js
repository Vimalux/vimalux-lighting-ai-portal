import { defaultProject, migrateProject } from "./model.js";

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function sourceGroup(group, index, existing = {}) {
  const technology = String(group?.technology || "Other");
  const dimmingPct = number(
    group?.existingDimmingPercent ??
      group?.dimmingPct ??
      existing?.dimmingPct ??
      existing?.existingDimmingPercent,
  );
  return {
    name: String(group?.group || group?.name || `Group ${index + 1}`),
    quantity: number(group?.quantity),
    technology,
    existingWattage: number(group?.nominalWatt ?? group?.existingWattage),
    existingSystemFactor: technology.toUpperCase().includes("SAP") ? 1.2 : technology.toUpperCase().includes("MH") || technology.toUpperCase().includes("MERCURY") || technology.toUpperCase().includes("HQL") ? 1.15 : 1,
    existingDimmingProfile: dimmingPct > 0 ? "fixed" : "none",
    existingDimmingPercent: dimmingPct,
    existingDimmingMethod: "average",
    existingDimmingNote: "Imported from VML Input Sheet",
    existingDriverType: "other",
    selectedForUpgrade: true,
    projectLedWattage: 0,
    ledProductId: "",
    smartEnabled: false,
    powerAidEnabled: false,
  };
}

export function projectFromBusinessCaseRow(row) {
  const stored = row?.intelligence_data && Object.keys(row.intelligence_data).length ? row.intelligence_data : null;
  const project = migrateProject(stored || defaultProject());
  const crm = row?.crm_fields || {};
  const source = row?.source_payload || {};
  const sourceAssumptions = source.assumptions || {};
  const existing = source.existingInstallation || {};
  const groups = Array.isArray(source.groups)
    ? source.groups
        .map((group, index) => sourceGroup(group, index, existing))
        .filter((group) => group.quantity > 0)
    : [];
  const commercial = source.commercial || {};
  const projectLineageId = row?.project_lineage_id || crm.project_lineage_id || project.crm?.projectLineageId || project.project?.projectLineageId || "";

  project.id = row.id;
  project.customer.name = crm.customer || crm.municipality || project.customer.name;
  project.project.name = crm.project || project.project.name;
  project.project.businessCaseId = row.business_case_code || project.project.businessCaseId;
  project.project.projectLineageId = projectLineageId;
  project.crm = {
    ...(project.crm || {}),
    projectLineageId,
    customerId: row.customer_id || "",
    opportunityId: row.crm_opportunity_id || "",
    uniqueProjectId: row.crm_opportunity_id || "",
    businessCaseRecordId: row.id,
    status: crm.stage || project.crm?.status || "lead",
    closingProbability: number(crm.probability),
    expectedCloseDate: crm.expected_close_date || "",
    agentId: crm.assigned_to_user_id || "",
    agentAccessMode: crm.agent_access_mode || project.crm?.agentAccessMode || "",
    syncSource: row.sync_source,
    syncVersion: row.sync_version,
    lastSyncedAt: row.last_synced_at,
    businessCase: row.result_summary && Object.keys(row.result_summary).length ? { ...row.result_summary, projectLineageId } : project.crm?.businessCase,
  };
  project.customer.province = crm.province || project.customer.province || "";
  project.customer.region = crm.region || project.customer.region || "";
  project.customer.country = crm.country || project.customer.country || "";

  // CRM owns the preliminary lamp count only until Intelligence has persisted a
  // technical installation. Once saved Intelligence groups exist, those groups
  // are authoritative; otherwise reopening a Business Case would overwrite a
  // user's edited lamp quantities with the older CRM estimate.
  const crmLampCount = number(crm.lamps ?? crm.luminaires ?? crm.lamp_count ?? crm.luminaire_count);
  const hasStoredGroups = Boolean(
    stored && Array.isArray(project.groups) && project.groups.length > 0,
  );
  if (crmLampCount > 0 && !hasStoredGroups) {
    const currentTotal = Array.isArray(project.groups)
      ? project.groups.reduce((sum, group) => sum + number(group?.quantity), 0)
      : 0;
    if (!Array.isArray(project.groups) || project.groups.length === 0) {
      project.groups = groups.length ? groups : [sourceGroup({ name: "Gruppo 1", quantity: crmLampCount }, 0, existing)];
    }
    if (project.groups.length === 1 || currentTotal !== crmLampCount) {
      const base = project.groups[0] || sourceGroup({ name: "Gruppo 1" }, 0, existing);
      project.groups = [{ ...base, quantity: crmLampCount }];
    }
  } else if (groups.length && !stored) {
    project.groups = groups;
  }

  if (!stored) {
    const operatingHours = groups.length
      ? groups.reduce((sum, group, index) => sum + number(source.groups[index]?.annualHours) * group.quantity, 0) / groups.reduce((sum, group) => sum + group.quantity, 0)
      : 0;
    project.assumptions.operatingHours = operatingHours || project.assumptions.operatingHours;
    project.assumptions.energyPrice = number(existing.energyPrice ?? sourceAssumptions.energyPrice) || project.assumptions.energyPrice;
    project.assumptions.energyEscalation = number(sourceAssumptions.energyEscalationPct) || project.assumptions.energyEscalation;
    project.assumptions.existingMaintenance = number(sourceAssumptions.maintenancePerLuminaire) || project.assumptions.existingMaintenance;
    project.assumptions.financingModel = commercial.financingModel || project.assumptions.financingModel;
    project.assumptions.financingPeriod = number(commercial.financingYears) || project.assumptions.financingPeriod;
    project.assumptions.serviceAgreementPeriod = number(commercial.contractYears) || project.assumptions.serviceAgreementPeriod;
    project.assumptions.analysisPeriod = number(commercial.analysisYears) || project.assumptions.analysisPeriod;
  }
  project.name = project.project.name;

  const migrated = migrateProject(project);
  migrated.crm.opportunityId = row.crm_opportunity_id || "";
  migrated.crm.uniqueProjectId = row.crm_opportunity_id || "";
  migrated.crm.projectLineageId = projectLineageId;
  migrated.project.projectLineageId = projectLineageId;
  return migrated;
}

export function businessCaseOpenUrl(caseId, origin = "https://app.vimalux.com") {
  return `${origin}/?business_case_id=${encodeURIComponent(caseId)}`;
}

export function isStableBusinessCaseLink(search = "") {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const id = params.get("business_case_id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
