import { numberValue } from "./calculations.js";

export const today = () => new Date().toISOString().slice(0, 10);
export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultProject = () => ({
  id: uid(), version: 1, language: "it", name: "Nuovo progetto", createdAt: today(), updatedAt: new Date().toISOString(),
  customer: { name: "", province: "", region: "", country: "Italia", contact: "", title: "", email: "", telephone: "" },
  project: { name: "Nuovo progetto", businessCaseId: `BC-${Date.now().toString().slice(-6)}`, consultant: "", date: today(), currency: "EUR" },
  crm: { status: "lead", closingProbability: 25, totalContractValue: null },
  groups: [{ id: uid(), name: "Gruppo 1", quantity: 100, technology: "SAP", existingWattage: 100, proposedProductId: "led-40", smartAssigned: true, powerAidAssigned: true }],
  solution: { smartEnabled: true, cmsEnabled: true, powerAidEnabled: false, lcuProductId: "lcu-1", gatewayProductId: "gateway-1", gatewayQuantity: 1, antennaProductId: "antenna-1", antennaQuantity: 1, meterProductId: "meter-1", meterQuantity: 1 },
  assumptions: { operatingHours: 4200, energyPrice: .25, sapFactor: 1.2, mhFactor: 1.15, mercuryFactor: 1.15, co2KgPerKwh: .233, cloPercent: 10, powerAidPercent: 40, powerAidSharePercent: 20, existingMaintenance: 25, newMaintenance: 5, financingModel: "cash", dealType: "cash", contractYears: 10, financingYears: 10, rateProfileId: "custom", interestRate: 5, interestRateSnapshot: { profileId: "custom", annualRate: 5, capturedAt: null }, allInclusiveAnnualPayment: 0, officialOfferCapex: 0, officialAnnualOpex: 0, upfrontPayment: 0, energyEscalation: 2, opexEscalation: 2, discountRate: 5, analysisPeriod: 20, freightCostPerLamp: 4, freightSalesPerLamp: 6, commissionPercent: 0, warrantyReservePercent: 0, fundingCostPercent: 0, otherDirectCosts: 0, minimumMarginPercent: 30 },
  pricing: { overrides: {} },
  catalogue: {
    led: [{ id: "led-40", brand: "VIMALUX", name: "VIMA LED 40", wattage: 40, lumen: 6000, costPrice: 90, salesPrice: 150, active: true }, { id: "led-70", brand: "VIMALUX", name: "VIMA LED 70", wattage: 70, lumen: 10500, costPrice: 125, salesPrice: 210, active: true }],
    smart: [
      { id: "lcu-1", brand: "VIMALUX", name: "LCU One", type: "LCU", costPrice: 25, salesPrice: 45, implementationCost: 8, implementationSalesPrice: 15, annualCost: 2, annualSalesPrice: 5, active: true },
      { id: "gateway-1", brand: "VIMALUX", name: "Gateway", type: "Gateway", costPrice: 500, salesPrice: 850, implementationCost: 0, implementationSalesPrice: 0, annualCost: 100, annualSalesPrice: 180, active: true },
      { id: "antenna-1", brand: "VIMALUX", name: "Antenna", type: "Antenna", costPrice: 80, salesPrice: 140, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
      { id: "meter-1", brand: "VIMALUX", name: "Energy Meter", type: "Energy Meter", costPrice: 120, salesPrice: 220, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
    ],
  },
});

const isImportedTotalGroup = (group) => /^(grand total|hovedtotal|total|totale generale|totale complessivo|i alt)$/i.test(String(group?.name ?? "").trim());

const merge = (base, saved) => {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === "object") return Object.fromEntries(Object.keys(base).map((key) => [key, merge(base[key], saved?.[key])]).concat(Object.keys(saved || {}).filter((key) => !(key in base)).map((key) => [key, saved[key]])));
  return saved == null ? base : saved;
};

export function migrateProject(saved) {
  const previousUpdatedAt = saved?.updatedAt || saved?.createdAt || "";
  const project = merge(defaultProject(), saved && typeof saved === "object" ? saved : {});
  project.updatedAt = previousUpdatedAt;
  project.language = ["it", "en", "da"].includes(project.language) ? project.language : "it";
  project.groups = (Array.isArray(project.groups) ? project.groups : [])
    .filter((group) => !isImportedTotalGroup(group))
    .map((g) => ({ ...g, id: g.id || uid() }));
  const legacyDealType = project.assumptions.financingModel === "finance" ? "finance" : ["laas", "ppp"].includes(project.assumptions.financingModel) ? "noleggio_operativo" : "cash";
  project.assumptions.dealType = ["cash", "noleggio_operativo", "finance"].includes(saved?.assumptions?.dealType) ? saved.assumptions.dealType : legacyDealType;
  project.assumptions.financingYears = Math.max(1, Math.round(numberValue(project.assumptions.financingYears || project.assumptions.contractYears)));
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
