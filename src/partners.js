import { calculateBusinessCase } from "./calculations.js";
import { crmMetrics } from "./crm.js";

import { PARTNER_ROLES, normalizePartner as partnerName, partnerOptions, productPartner, productRoles, selectedEquipmentRole } from "./partnerRoles.js";

// Configured CMS / Lighting Control partners stay selectable even before every
// partner has products loaded in the catalogue. Catalogue metadata still controls
// which LCU / CMS products are available after a partner is selected.
export const CMS_PARTNERS = ["DATEK", "ITRON", "TVILIGHT", "OPTION"];
export const cmsPartnerOptions = (source = []) => [...new Set([
  ...CMS_PARTNERS,
  ...partnerOptions(source, "CMS"),
])].sort();
export function adaptiveDimmingPartnerOptions(source = []) {
  const projects = Array.isArray(source) ? source : [source];
  const names = partnerOptions(projects, "ADAPTIVE_DIMMING");
  for (const project of projects) {
    const legacy = resolveAdaptiveDimmingPartner(project);
    if (legacy) names.push(legacy);
  }
  return [...new Set(names)].sort();
}
export function resolveCmsPartner(project) {
  const explicit = partnerName(project?.solution?.cmsPartner);
  if (explicit) return explicit;
  const selected = (project?.catalogue?.smart || []).find((item) => item.id === project?.solution?.lcuProductId);
  if (selected && productRoles(selected).includes("CMS")) return productPartner(selected, "CMS");
  return project?.solution?.smartEnabled && project?.solution?.cmsEnabled && !selected ? "DATEK" : "";
}
export function resolveAdaptiveDimmingPartner(project) {
  if (!project?.solution?.powerAidEnabled) return "";
  // An explicitly empty selection must not silently revert to the legacy supplier.
  if (Object.hasOwn(project.solution, "adaptiveDimmingPartner")) return partnerName(project.solution.adaptiveDimmingPartner);
  const ids = new Set((project.solution.partnerEquipment || []).map((row) => row.productId));
  const selected = (project.catalogue?.smart || []).find((item) => ids.has(item.id) && productRoles(item).includes("ADAPTIVE_DIMMING"));
  return selected ? productPartner(selected, "ADAPTIVE_DIMMING") : "FELICITY";
}
export function projectPartnerRoles(project) {
  const entries = [];
  const add = (partner, role) => { if (partner && !entries.some((entry) => entry.partner === partner && entry.role === role)) entries.push({ partner, role }); };
  if (project.solution?.smartEnabled && project.solution?.cmsEnabled) {
    const partner = resolveCmsPartner(project);
    if (cmsPartnerOptions(project).includes(partner)) add(partner, "CMS");
  }
  if (project.solution?.powerAidEnabled) add(resolveAdaptiveDimmingPartner(project), "ADAPTIVE_DIMMING");
  for (const row of project.solution?.partnerEquipment || []) {
    const product = (project.catalogue?.smart || []).find((item) => item.id === row.productId);
    if (!product || product.active === false || !(Number(row.quantity) > 0)) continue;
    const role = selectedEquipmentRole(row, product);
    if (role !== "CMS" && role !== "ADAPTIVE_DIMMING") add(productPartner(product, role), role);
  }
  return entries;
}
export function partnerReportOptions(projects = []) {
  const entries = new Map();
  for (const project of projects) for (const entry of projectPartnerRoles(project)) {
    if (entry.partner === "VIMALUX") continue; // Reserved consolidated business report.
    const key = entry.partner + ":" + entry.role;
    entries.set(key, { ...entry, key, label: entry.partner + " · " + PARTNER_ROLES[entry.role] });
  }
  return [...entries.values()].sort((a,b) => a.key.localeCompare(b.key));
}
export function technologyPartnerOptions(projects = []) {
  return [...new Set(partnerReportOptions(projects).map((entry) => entry.partner))];
}

export function partnerProjectRows(projects = [], partner, role) {
  const normalizedPartner = partnerName(partner);
  const consolidated = normalizedPartner === "VIMALUX";
  const sourceProjects = consolidated ? projects : projects.filter((project) => projectPartnerRoles(project)
    .some((entry) => entry.partner === normalizedPartner && (!role || entry.role === role)));

  return sourceProjects.map((project) => {
    const roles = consolidated ? [] : projectPartnerRoles(project).filter((entry) => entry.partner === normalizedPartner && (!role || entry.role === role)).map((entry) => entry.role);
    const isCmsPartner = roles.includes("CMS");
    const isAdaptivePartner = roles.includes("ADAPTIVE_DIMMING");
    const result = calculateBusinessCase(project);
    const crm = crmMetrics(project);
    const years = Math.max(1, Math.round(Number(project.assumptions.contractYears) || 1));
    const common = {
      id: project.id,
      municipality: project.customer.name || "-",
      project: project.project.name || "-",
      luminaires: result.totalQuantity,
      lcus: result.lcuQuantity,
      contractYears: years,
      partnerRole: consolidated ? "VIMALUX" : roles.join(" + "),
    };

    if (!consolidated) {
      const cmsContract = isCmsPartner ? Array.from({ length: years }, (_, i) => result.cmsRevenue * Math.pow(1 + Number(project.assumptions.opexEscalation || 0) / 100, i)).reduce((a, b) => a + b, 0) : 0;
      const otherRows = (project.solution?.partnerEquipment || []).flatMap((selection) => {
        const product = (project.catalogue?.smart || []).find((item) => item.id === selection.productId);
        return product && product.active !== false && roles.some((r) => r !== "CMS" && r !== "ADAPTIVE_DIMMING" && selectedEquipmentRole(selection, product) === r && productPartner(product,r) === normalizedPartner) ? [{ product, quantity: Math.max(0, Number(selection.quantity) || 0) }] : [];
      });
      const equipmentAnnual = otherRows.reduce((sum, { product, quantity }) => sum + quantity * (Number(product.annualCost) || 0), 0);
      const equipmentCapex = otherRows.reduce((sum, { product, quantity }) => sum + quantity * ((Number(product.costPrice) || 0) + (Number(product.implementationCost) || 0)), 0);
      const annualRevenue = (isCmsPartner ? result.cmsRevenue : 0) + (isAdaptivePartner ? result.powerAidSupplierCost : 0) + equipmentAnnual;
      return {
        ...common,
        ...(isCmsPartner ? { probability: crm.probability, pipelineTcv: crm.totalContractValue, weightedTcv: crm.weightedTcv } : {}),
        annualRevenue, mrr: annualRevenue / 12, arr: annualRevenue,
        ...(isAdaptivePartner ? { customerFee: result.powerAidCustomerFee, vimaluxMargin: result.powerAidVimaluxMargin } : {}),
        totalContractValue: cmsContract + (isAdaptivePartner ? result.powerAidSupplierContractCost : 0) + equipmentCapex + Array.from({ length: years }, (_, i) => equipmentAnnual * Math.pow(1 + Number(project.assumptions.opexEscalation || 0) / 100, i)).reduce((a,b) => a+b,0),
      };
    }

    return {
      ...common,
      annualRevenue: result.annualRecurringRevenue,
      mrr: result.annualRecurringRevenue / 12,
      arr: result.annualRecurringRevenue,
      totalContractValue: result.totalContractRevenue,
    };
  });
}

export function partnerTotals(projects, partner, role) {
  const rows = partnerProjectRows(projects, partner, role);
  const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const municipalities = new Set(rows.map((row) => row.municipality).filter((value) => value !== "-")).size;
  return {
    rows,
    municipalities,
    projects: rows.length,
    luminaires: sum("luminaires"),
    lcus: sum("lcus"),
    annualRevenue: sum("annualRevenue"),
    mrr: sum("mrr"),
    arr: sum("arr"),
    totalContractValue: sum("totalContractValue"),
    pipelineTcv: sum("pipelineTcv"),
    weightedTcv: sum("weightedTcv"),
  };
}

export function growthForecast(arr, annualGrowthPercent = 10, years = 5) {
  return Array.from({ length: years }, (_, index) => ({ year: index + 1, arr: arr * Math.pow(1 + annualGrowthPercent / 100, index) }));
}
