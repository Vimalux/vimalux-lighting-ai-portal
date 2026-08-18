import { numberValue } from "./calculations.js";
import { parseNoleggioWorkbook } from "./lightingImport.js";

const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[%_./()-]+/g, " ").replace(/\s+/g, " ");
const text = (value) => String(value ?? "").trim();
const bool = (value) => ["yes", "y", "true", "1", "si", "sì", "ja"].includes(clean(value));
const percentage = (value) => numberValue(value);
const sourceFormats = { agent: "VML Agent Input Sheet", legacy: "Existing CRM Import", manual: "Manual" };

const aliases = {
  customer_id: ["customer id", "cliente id"], municipality_name: ["municipality", "municipality name", "comune", "customer name", "cliente"], province: ["province", "provincia"], region: ["region", "regione"], country: ["country", "paese"],
  contact_id: ["contact id"], contact_name: ["contact", "contact name", "referente"], contact_title: ["title", "contact title", "ruolo"], contact_email: ["email", "contact email"], contact_phone: ["phone", "telephone", "telefono"],
  agent_id: ["agent id"], agent_name: ["agent", "agent name", "consultant", "consulente"], source: ["source", "lead source", "origine"],
  opportunity_id: ["opportunity id", "unique project id", "unique_project_id", "project id"], project_name: ["project name", "progetto"], business_case_id: ["business case id", "quotation id", "quotation_id"], stage: ["stage", "pipeline stage", "status"], probability_pct: ["probability", "probability pct", "closing probability"], expected_close_date: ["expected close date", "close date"], go_status: ["go status", "assessment"], notes: ["notes", "note"],
  total_luminaires: ["total luminaires", "luminaires", "lamps", "lampade"], existing_technology: ["existing technology", "technology", "tecnologia"], average_existing_watt: ["average existing watt", "existing watt", "wattage"], annual_operating_hours: ["annual operating hours", "operating hours", "hours"], energy_price: ["energy price", "electricity price"], existing_dimming_profile: ["existing dimming profile", "dimming profile"], existing_dimming_pct: ["existing dimming pct", "dimming pct", "dimming"], existing_driver_type: ["existing driver type", "driver type"], smart_lighting_enabled: ["smart lighting", "smart lighting enabled", "smart"], cms_enabled: ["cms", "cms enabled"], poweraid_enabled: ["poweraid", "poweraid enabled"],
  financing_model: ["financing model", "commercial structure", "deal type"], financing_period_years: ["financing period", "financing years", "finance years"], service_agreement_period_years: ["service agreement period", "service years", "contract years"], analysis_period_years: ["analysis period", "analysis years"], business_case_url: ["business case url", "business case link"],
};

const findAlias = (header) => Object.entries(aliases).find(([, values]) => values.some((alias) => clean(header) === clean(alias)))?.[0] || "";

function normalizeFinancingModel(value) {
  const model = clean(value);
  if (["cash", "cash purchase", "cash deal", "contanti"].includes(model)) return "cash";
  if (["finance", "financed", "financed solution", "loan", "lease", "finanziato"].includes(model) || /finance|loan|lease|finanzi/.test(model)) return "finance";
  if (["laas", "lighting as a service", "noleggio", "noleggio operativo", "ppp"].includes(model) || /laas|lighting as a service|noleggio/.test(model)) return "noleggio_operativo";
  return text(value);
}

function recordToOpportunity(record, sourceFormat, templateVersion = "RC1") {
  const get = (key) => record[key] ?? "";
  const financingModel = normalizeFinancingModel(get("financing_model"));
  return {
    customer: { customerId: text(get("customer_id")), municipalityName: text(get("municipality_name")), province: text(get("province")), region: text(get("region")), country: text(get("country")) || "Italia" },
    contact: { contactId: text(get("contact_id")), name: text(get("contact_name")), title: text(get("contact_title")), email: text(get("contact_email")), phone: text(get("contact_phone")) },
    source: { agentId: text(get("agent_id")), agentName: text(get("agent_name")), source: text(get("source")) },
    opportunity: { opportunityId: text(get("opportunity_id")), uniqueProjectId: text(get("opportunity_id")), projectName: text(get("project_name")) || text(get("municipality_name")), businessCaseId: text(get("business_case_id")), stage: clean(get("stage")) || "lead", probabilityPct: text(get("probability_pct")) === "" ? 25 : percentage(get("probability_pct")), expectedCloseDate: text(get("expected_close_date")), goStatus: text(get("go_status")).toUpperCase(), notes: text(get("notes")) },
    assumptions: { totalLuminaires: numberValue(get("total_luminaires")), existingTechnology: text(get("existing_technology")) || "OTHER", averageExistingWatt: numberValue(get("average_existing_watt")), annualOperatingHours: numberValue(get("annual_operating_hours")), energyPrice: numberValue(get("energy_price")), existingDimmingProfile: clean(get("existing_dimming_profile")) || "none", existingDimmingPct: percentage(get("existing_dimming_pct")), existingDriverType: text(get("existing_driver_type")), smartLightingEnabled: bool(get("smart_lighting_enabled")), cmsEnabled: bool(get("cms_enabled")), powerAidEnabled: bool(get("poweraid_enabled")) },
    commercial: { financingModel, financingPeriodYears: numberValue(get("financing_period_years")), serviceAgreementPeriodYears: numberValue(get("service_agreement_period_years")), analysisPeriodYears: numberValue(get("analysis_period_years")) },
    businessCaseUrl: text(get("business_case_url")),
    importMeta: { sourceFormat, templateVersion, raw: record },
  };
}

export function validateOpportunity(opportunity) {
  const errors = [];
  const raw = opportunity.importMeta?.raw || {};
  if (!opportunity.customer?.municipalityName) errors.push({ field: "municipality_name", message: "Missing municipality" });
  if ((text(raw.total_luminaires) && !(opportunity.assumptions?.totalLuminaires > 0)) || opportunity.assumptions?.totalLuminaires < 0 || !Number.isFinite(opportunity.assumptions?.totalLuminaires)) errors.push({ field: "total_luminaires", message: "Invalid quantity" });
  if ((text(raw.average_existing_watt) && !(opportunity.assumptions?.averageExistingWatt > 0)) || opportunity.assumptions?.averageExistingWatt < 0 || !Number.isFinite(opportunity.assumptions?.averageExistingWatt)) errors.push({ field: "average_existing_watt", message: "Invalid wattage" });
  if (opportunity.opportunity?.probabilityPct < 0 || opportunity.opportunity?.probabilityPct > 100) errors.push({ field: "probability_pct", message: "Invalid percentage" });
  if (opportunity.assumptions?.existingDimmingPct < 0 || opportunity.assumptions?.existingDimmingPct > 100) errors.push({ field: "existing_dimming_pct", message: "Invalid percentage" });
  if (opportunity.commercial?.financingModel && !["cash", "finance", "noleggio_operativo"].includes(opportunity.commercial.financingModel)) errors.push({ field: "financing_model", message: "Unsupported financing model" });
  return errors;
}

function parseAgentSheet(sheet) {
  const headers = sheet.headers || [];
  const fieldIndex = headers.findIndex((value) => clean(value) === "field");
  const valueIndex = headers.findIndex((value) => clean(value) === "value");
  if (fieldIndex >= 0 && valueIndex >= 0) {
    const record = {};
    sheet.rows.forEach((row) => { const key = findAlias(row[fieldIndex]) || clean(row[fieldIndex]).replace(/ /g, "_"); if (key) record[key] = row[valueIndex]; });
    return [record];
  }
  const mapping = headers.map(findAlias);
  return sheet.rows.map((row) => Object.fromEntries(mapping.map((key, index) => [key, row[index]]).filter(([key]) => key)));
}

export function parseOpportunityWorkbook(sheets, selectedSource = "agent") {
  if (selectedSource === "legacy") {
    const legacy = parseNoleggioWorkbook(sheets);
    const opportunity = recordToOpportunity({
      municipality_name: legacy.customerName,
      project_name: legacy.projectName,
      business_case_id: legacy.quotationId,
      opportunity_id: legacy.raw?.opportunity_id || legacy.quotationId,
      total_luminaires: legacy.lamps,
      financing_model: "noleggio_operativo",
      financing_period_years: legacy.financingYears,
      service_agreement_period_years: legacy.serviceContractYears,
      analysis_period_years: legacy.raw?.analysis_period_years || 20,
      stage: "proposal",
      probability_pct: 25,
    }, sourceFormats.legacy, String(legacy.mappingVersion || 1));
    opportunity.legacyCommercial = legacy;
    return { sourceFormat: sourceFormats.legacy, templateVersion: String(legacy.mappingVersion || 1), opportunities: [opportunity], warnings: legacy.warnings || [] };
  }
  const sheet = sheets.find((item) => /vml.*agent/i.test(item.name)) || sheets[0];
  if (!sheet) throw new Error("Workbook contains no readable sheet.");
  const records = parseAgentSheet(sheet).filter((record) => Object.keys(record).length);
  const opportunities = records.map((record) => recordToOpportunity(record, sourceFormats.agent));
  return { sourceFormat: sourceFormats.agent, templateVersion: "RC1", opportunities, warnings: [] };
}

export function createImportAudit({ fileName = "", sourceFormat = "", templateVersion = "", importedBy = "", created = 0, updated = 0, skipped = 0, errors = 0 }) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, fileName, sourceFormat, templateVersion, importedBy, timestamp: new Date().toISOString(), created, updated, skipped, errors };
}
