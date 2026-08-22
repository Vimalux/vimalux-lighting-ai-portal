import { numberValue } from "./calculations.js";

export const today = () => new Date().toISOString().slice(0, 10);
export const uid = () => Math.random().toString(36).slice(2, 10);

const FALLBACK_CATALOGUE = {
  led: [
    { id: "led-40", brand: "VIMALUX", name: "VIMA LED 40", wattage: 40, lumen: 6000, costPrice: 90, salesPrice: 150, active: true },
    { id: "led-70", brand: "VIMALUX", name: "VIMA LED 70", wattage: 70, lumen: 10500, costPrice: 125, salesPrice: 210, active: true },
  ],
  smart: [
    { id: "lcu-1", brand: "VIMALUX", name: "LCU One", type: "LCU", costPrice: 25, salesPrice: 45, implementationCost: 8, implementationSalesPrice: 15, annualCost: 2, annualSalesPrice: 5, active: true },
    { id: "gateway-1", brand: "VIMALUX", name: "Gateway", type: "Gateway", costPrice: 500, salesPrice: 850, implementationCost: 0, implementationSalesPrice: 0, annualCost: 100, annualSalesPrice: 180, active: true },
    { id: "antenna-1", brand: "VIMALUX", name: "Antenna", type: "Antenna", costPrice: 80, salesPrice: 140, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
    { id: "meter-1", brand: "VIMALUX", name: "Energy Meter", type: "Energy Meter", costPrice: 120, salesPrice: 220, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
  ],
};

const cloneCatalogue = (catalogue) => ({
  led: Array.isArray(catalogue?.led) ? catalogue.led.map((item) => ({ ...item })) : [],
  smart: Array.isArray(catalogue?.smart) ? catalogue.smart.map((item) => ({ ...item })) : [],
});

export function storedMasterCatalogue() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("vimalux-intelligence-projects");
    const parsed = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
    let best = null;
    let bestScore = -1;
    for (const item of list) {
      const catalogue = item?.catalogue;
      if (!Array.isArray(catalogue?.led) || !Array.isArray(catalogue?.smart)) continue;
      const score = catalogue.led.length + catalogue.smart.length;
      if (score > bestScore) { best = catalogue; bestScore = score; }
    }
    return best ? cloneCatalogue(best) : null;
  } catch {
    return null;
  }
}

export const defaultProject = () => ({
  id: uid(), version: 1, language: "it", name: "Nuovo progetto", createdAt: today(), updatedAt: new Date().toISOString(),
  customer: { name: "", province: "", region: "", country: "Italia", contact: "", title: "", email: "", telephone: "" },
  project: { name: "Nuovo progetto", businessCaseId: `BC-${Date.now().toString().slice(-6)}`, consultant: "", date: today(), currency: "EUR" },
  crm: { customerId: "", contactId: "", agentId: "", agentName: "", source: "", opportunityId: "", uniqueProjectId: "", status: "lead", closingProbability: 25, totalContractValue: null, expectedCloseDate: "", goStatus: "", notes: "", businessCaseUrl: "", plannerProjectUrl: "", businessCase: null, importHistory: [] },
  groups: [{ id: uid(), name: "Gruppo 1", quantity: 100, technology: "SAP", existingWattage: 100, existingSystemFactor: 0, existingDimmingProfile: "none", existingDimmingMethod: "average", existingDimmingPercent: 0, existingFullPowerHours: 0, existingReducedHours: 0, existingReducedLoadPercent: 100, existingDimmingNote: "", existingDriverType: "non_dimmable", upgradeSelected: true, proposedProductId: "led-40", projectLedWattage: null, smartAssigned: true, powerAidAssigned: true }],
  solution: { smartEnabled: true, cmsEnabled: true, powerAidEnabled: false, lcuProductId: "lcu-1", panelEquipmentEnabled: false, gatewayProductId: "gateway-1", gatewayQuantity: 0, antennaProductId: "antenna-1", antennaQuantity: 0, meterProductId: "meter-1", meterQuantity: 0 },
  assumptions: { operatingHours: 4200, energyPrice: .29, sapFactor: 1.2, mhFactor: 1.15, mercuryFactor: 1.15, co2KgPerKwh: .233, cloPercent: 10, powerAidPercent: 40, powerAidCustomerFeePercent: 30, powerAidSupplierSharePercent: 70, existingMaintenance: 25, newMaintenance: 5, financingModel: "cash", dealType: "cash", financingPeriod: 5, serviceAgreementPeriod: 10, analysisPeriod: 20, contractYears: 10, financingYears: 5, rateProfileId: "custom", interestRate: 5, interestRateSnapshot: { profileId: "custom", annualRate: 5, capturedAt: null }, allInclusiveAnnualPayment: 0, officialOfferCapex: 0, officialAnnualOpex: 0, upfrontPayment: 0, energyEscalation: 2, opexEscalation: 2, discountRate: 5, freightCostPerLamp: 4, freightSalesPerLamp: 6, dutyCost: 0, commissionPercent: 0, agent1Name: "", agent1CommissionPercent: 0, agent2Name: "", agent2CommissionPercent: 0, warrantyReservePercent: 0, fundingCostPercent: 0, otherDirectCosts: 0, minimumMarginPercent: 30 },
  additionalCosts: [],
  pricing: { overrides: {} },
  catalogue: storedMasterCatalogue() || cloneCatalogue(FALLBACK_CATALOGUE),
});

const isImportedTotalGroup = (group) => /^(grand total|hovedtotal|total|totale generale|totale complessivo|i alt)$/i.test(String(group?.name ?? "").trim());
const normalizeIdentity = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const commercialAssumptionKeys = [
  "dealType", "financingModel", "contractYears", "financingYears", "financingPeriod", "serviceAgreementPeriod",
  "interestRate", "rateProfileId", "interestRateSnapshot", "allInclusiveAnnualPayment", "officialOfferCapex", "officialAnnualOpex",
];

const mergeNonEmpty = (existing = {}, incoming = {}) => {
  const result = { ...existing };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (value !== "" && value != null) result[key] = value;
  });
  return result;
};

export function reconcileReimportIdentity(incoming, candidates = []) {
  if (!incoming || typeof incoming !== "object") return incoming;
  if (!incoming.importedTechnical && !incoming.importedCommercial) return incoming;
  const incomingName = normalizeIdentity(incoming.project?.name || incoming.name);
  if (!incomingName || incomingName === "nuovo progetto") return incoming;

  const incomingCustomer = normalizeIdentity(incoming.customer?.name);
  const matches = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate && candidate.id !== incoming.id)
    .filter((candidate) => normalizeIdentity(candidate.project?.name || candidate.name) === incomingName)
    .filter((candidate) => {
      if (!incomingCustomer) return true;
      const candidateCustomer = normalizeIdentity(candidate.customer?.name);
      return !candidateCustomer || candidateCustomer === incomingCustomer;
    })
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));

  const preferredId = typeof localStorage !== "undefined" ? String(localStorage.getItem("vimalux-reimport-target-id") || "") : "";
  const existing = (preferredId && matches.find((candidate) => String(candidate.id) === preferredId)) || matches[0];
  if (!existing) return incoming;

  const isCommercial = Boolean(incoming.importedCommercial);
  const assumptions = isCommercial
    ? commercialAssumptionKeys.reduce((next, key) => {
        if (incoming.assumptions?.[key] !== undefined) next[key] = incoming.assumptions[key];
        return next;
      }, { ...(existing.assumptions || {}) })
    : (existing.assumptions || incoming.assumptions);

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    createdAt: existing.createdAt || incoming.createdAt,
    customer: mergeNonEmpty(existing.customer, incoming.customer),
    project: {
      ...(existing.project || {}),
      ...(incoming.project || {}),
      businessCaseId: existing.project?.businessCaseId || incoming.project?.businessCaseId || "",
    },
    crm: { ...(existing.crm || {}) },
    groups: Array.isArray(incoming.groups) ? incoming.groups : existing.groups,
    assumptions,
    solution: existing.solution || incoming.solution,
    additionalCosts: existing.additionalCosts || incoming.additionalCosts || [],
    pricing: existing.pricing || incoming.pricing,
    catalogue: existing.catalogue || incoming.catalogue,
    importedTechnical: incoming.importedTechnical || existing.importedTechnical,
    importedCommercial: incoming.importedCommercial || existing.importedCommercial,
    updatedAt: incoming.updatedAt || new Date().toISOString(),
  };
}

const storedProjectsForReimport = () => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("vimalux-intelligence-projects");
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch {
    return [];
  }
};

const merge = (base, saved) => {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === "object") return Object.fromEntries(Object.keys(base).map((key) => [key, merge(base[key], saved?.[key])]).concat(Object.keys(saved || {}).filter((key) => !(key in base)).map((key) => [key, saved[key]])));
  return saved == null ? base : saved;
};

export function migrateProject(saved) {
  const reconciled = reconcileReimportIdentity(saved, storedProjectsForReimport());
  saved = reconciled;
  const previousUpdatedAt = saved?.updatedAt || saved?.createdAt || "";
  const project = merge(defaultProject(), saved && typeof saved === "object" ? saved : {});
  project.updatedAt = previousUpdatedAt;
  project.language = ["it", "en", "da"].includes(project.language) ? project.language : "it";
  project.groups = (Array.isArray(project.groups) ? project.groups : [])
    .filter((group) => !isImportedTotalGroup(group))
    .map((g) => ({ existingSystemFactor: 0, existingDimmingProfile: "none", existingDimmingMethod: "average", existingDimmingPercent: 0, existingFullPowerHours: 0, existingReducedHours: 0, existingReducedLoadPercent: 100, existingDimmingNote: "", existingDriverType: "non_dimmable", upgradeSelected: true, ...g, projectLedWattage: g.projectLedWattage ?? g.importedProposedWattage ?? null, id: g.id || uid() }));
  project.additionalCosts = (Array.isArray(project.additionalCosts) ? project.additionalCosts : []).map((item) => ({
    id: item?.id || uid(),
    description: String(item?.description || ""),
    category: ["materiale", "lavoro", "opere_civili", "servizi", "altro"].includes(item?.category) ? item.category : "altro",
    costType: item?.costType === "opex_annual" ? "opex_annual" : "capex",
    quantity: Math.max(0, numberValue(item?.quantity)),
    unit: String(item?.unit || "pz"),
    unitCost: Math.max(0, numberValue(item?.unitCost)),
    unitSalesPrice: Math.max(0, numberValue(item?.unitSalesPrice)),
    note: String(item?.note || ""),
  }));
  const legacyDealType = project.assumptions.financingModel === "finance" ? "finance" : ["laas", "ppp"].includes(project.assumptions.financingModel) ? "noleggio_operativo" : "cash";
  project.assumptions.dealType = ["cash", "noleggio_operativo", "finance"].includes(saved?.assumptions?.dealType) ? saved.assumptions.dealType : legacyDealType;
  const legacyContractYears = numberValue(saved?.assumptions?.contractYears ?? saved?.assumptions?.years);
  const savedFinancingPeriod = numberValue(saved?.assumptions?.financingPeriod);
  const savedServicePeriod = numberValue(saved?.assumptions?.serviceAgreementPeriod);
  project.assumptions.financingPeriod = Math.max(1, Math.round((savedFinancingPeriod !== 5 ? savedFinancingPeriod : numberValue(saved?.assumptions?.financingYears)) || legacyContractYears || 5));
  project.assumptions.serviceAgreementPeriod = Math.max(1, Math.round((savedServicePeriod !== 10 ? savedServicePeriod : legacyContractYears) || 10));
  project.assumptions.analysisPeriod = Math.max(1, Math.round(numberValue(saved?.assumptions?.analysisPeriod) || Math.max(legacyContractYears, 20)));
  project.assumptions.financingYears = project.assumptions.financingPeriod;
  project.assumptions.contractYears = project.assumptions.serviceAgreementPeriod;
  project.crm.opportunityId = project.crm.opportunityId || "";
  project.crm.uniqueProjectId = project.crm.uniqueProjectId || project.crm.opportunityId || "";
  project.crm.importHistory = Array.isArray(project.crm.importHistory) ? project.crm.importHistory : [];
  if (!project.solution.smartEnabled) project.solution.cmsEnabled = false;
  if (!project.solution.smartEnabled || !project.solution.cmsEnabled) project.solution.powerAidEnabled = false;
  if (saved?.solution?.panelEquipmentEnabled == null) {
    project.solution.panelEquipmentEnabled = ["gatewayQuantity", "antennaQuantity", "meterQuantity"]
      .some((key) => numberValue(saved?.solution?.[key]) > 0);
  }
  if (saved?.assumptions?.powerAidCustomerFeePercent == null && saved?.assumptions?.powerAidSharePercent != null) project.assumptions.powerAidCustomerFeePercent = numberValue(saved.assumptions.powerAidSharePercent);
  if (saved?.assumptions?.agent1CommissionPercent == null && saved?.assumptions?.commissionPercent != null) project.assumptions.agent1CommissionPercent = numberValue(saved.assumptions.commissionPercent);
  project.assumptions.rateProfileId = project.assumptions.rateProfileId || "custom";
  project.assumptions.interestRateSnapshot = project.assumptions.interestRateSnapshot || { profileId: project.assumptions.rateProfileId, annualRate: numberValue(project.assumptions.interestRate), capturedAt: null };
  return project;
}

export function loadProjects() {
  try {
    const raw = localStorage.getItem("vimalux-intelligence-projects");
    const parsed = raw ? JSON.parse(raw) : null;
    const list = Array.isArray(parsed) ? parsed : parsed?.projects;
    return list?.length ? list.map(migrateProject) : [defaultProject()];
  } catch { return [defaultProject()]; }
}

export const normalizeNumericFields = (object) => Object.fromEntries(Object.entries(object).map(([k, v]) => [k, typeof v === "string" && v.trim() !== "" ? numberValue(v) : v]));