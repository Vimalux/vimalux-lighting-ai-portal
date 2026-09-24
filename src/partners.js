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

const escalatingTotal = (annual, ratePercent, years) => Array.from({ length: Math.max(0, Math.round(Number(years) || 0)) }, (_, index) => (Number(annual) || 0) * Math.pow(1 + (Number(ratePercent) || 0) / 100, index)).reduce((sum, value) => sum + value, 0);
const marginPercent = (margin, revenue) => revenue ? margin / revenue * 100 : 0;

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
    const years = Math.max(1, Math.round(Number(project.assumptions.contractYears) || Number(result.serviceAgreementPeriod) || 1));
    const serviceYears = Math.max(1, Math.round(Number(result.serviceAgreementPeriod) || years));
    const opexRate = Number(project.assumptions.opexEscalation || 0);
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
      const otherRows = (project.solution?.partnerEquipment || []).flatMap((selection) => {
        const product = (project.catalogue?.smart || []).find((item) => item.id === selection.productId);
        return product && product.active !== false && roles.some((r) => r !== "CMS" && r !== "ADAPTIVE_DIMMING" && selectedEquipmentRole(selection, product) === r && productPartner(product,r) === normalizedPartner) ? [{ product, quantity: Math.max(0, Number(selection.quantity) || 0) }] : [];
      });

      const equipmentAnnualCustomerRevenue = otherRows.reduce((sum, { product, quantity }) => sum + quantity * (Number(product.annualSalesPrice) || 0), 0);
      const equipmentAnnualSupplierCost = otherRows.reduce((sum, { product, quantity }) => sum + quantity * (Number(product.annualCost) || 0), 0);
      const equipmentCapexCustomerValue = otherRows.reduce((sum, { product, quantity }) => sum + quantity * ((Number(product.salesPrice) || 0) + (Number(product.implementationSalesPrice) || 0)), 0);
      const equipmentCapexSupplierCost = otherRows.reduce((sum, { product, quantity }) => sum + quantity * ((Number(product.costPrice) || 0) + (Number(product.implementationCost) || 0)), 0);

      const cmsAnnualCustomerRevenue = isCmsPartner ? Number(result.cmsRevenue) || 0 : 0;
      const cmsAnnualSupplierCost = isCmsPartner ? Number(result.cmsDirectCost) || 0 : 0;
      const adaptiveAnnualCustomerRevenue = isAdaptivePartner ? Number(result.powerAidCustomerFee) || 0 : 0;
      const adaptiveAnnualSupplierCost = isAdaptivePartner ? Number(result.powerAidSupplierCost) || 0 : 0;

      const annualCustomerRevenue = cmsAnnualCustomerRevenue + adaptiveAnnualCustomerRevenue + equipmentAnnualCustomerRevenue;
      const annualSupplierCost = cmsAnnualSupplierCost + adaptiveAnnualSupplierCost + equipmentAnnualSupplierCost;
      const annualVimaluxMargin = annualCustomerRevenue - annualSupplierCost;

      const cmsCustomerContractValue = isCmsPartner ? escalatingTotal(cmsAnnualCustomerRevenue, opexRate, serviceYears) : 0;
      const cmsSupplierContractCost = isCmsPartner ? escalatingTotal(cmsAnnualSupplierCost, opexRate, serviceYears) : 0;
      const adaptiveCustomerContractValue = isAdaptivePartner ? Number(result.powerAidContractRevenue) || 0 : 0;
      const adaptiveSupplierContractCost = isAdaptivePartner ? Number(result.powerAidSupplierContractCost) || 0 : 0;
      const equipmentCustomerContractValue = equipmentCapexCustomerValue + escalatingTotal(equipmentAnnualCustomerRevenue, opexRate, serviceYears);
      const equipmentSupplierContractCost = equipmentCapexSupplierCost + escalatingTotal(equipmentAnnualSupplierCost, opexRate, serviceYears);
      const customerContractValue = cmsCustomerContractValue + adaptiveCustomerContractValue + equipmentCustomerContractValue;
      const supplierContractCost = cmsSupplierContractCost + adaptiveSupplierContractCost + equipmentSupplierContractCost;
      const contractMargin = customerContractValue - supplierContractCost;

      return {
        ...common,
        ...(isCmsPartner ? { probability: crm.probability, pipelineTcv: crm.totalContractValue, weightedTcv: crm.weightedTcv } : {}),
        annualCustomerRevenue,
        annualSupplierCost,
        annualVimaluxMargin,
        annualMarginPercent: marginPercent(annualVimaluxMargin, annualCustomerRevenue),
        customerContractValue,
        supplierContractCost,
        contractMargin,
        contractMarginPercent: marginPercent(contractMargin, customerContractValue),
        // Backward-compatible aliases. "annualRevenue" and "totalContractValue"
        // now consistently mean VIMALUX customer sales, not supplier payable value.
        annualRevenue: annualCustomerRevenue,
        mrr: annualCustomerRevenue / 12,
        arr: annualCustomerRevenue,
        totalContractValue: customerContractValue,
        ...(isAdaptivePartner ? { customerFee: result.powerAidCustomerFee, vimaluxMargin: result.powerAidVimaluxMargin } : {}),
      };
    }

    const annualCustomerRevenue = Number(result.annualRecurringRevenue) || 0;
    const annualSupplierCost = (Number(result.annualOpexDirectCost) || 0) + (Number(result.powerAidSupplierCost) || 0);
    const annualVimaluxMargin = annualCustomerRevenue - annualSupplierCost;
    const customerContractValue = Number(result.totalContractRevenue) || 0;
    const supplierContractCost = Number(result.totalDirectCosts) || 0;
    const contractMargin = Number(result.netProjectProfit) || (customerContractValue - supplierContractCost);
    return {
      ...common,
      annualCustomerRevenue,
      annualSupplierCost,
      annualVimaluxMargin,
      annualMarginPercent: marginPercent(annualVimaluxMargin, annualCustomerRevenue),
      customerContractValue,
      supplierContractCost,
      contractMargin,
      contractMarginPercent: marginPercent(contractMargin, customerContractValue),
      annualRevenue: annualCustomerRevenue,
      mrr: annualCustomerRevenue / 12,
      arr: annualCustomerRevenue,
      totalContractValue: customerContractValue,
    };
  });
}

export function partnerTotals(projects, partner, role) {
  const rows = partnerProjectRows(projects, partner, role);
  const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const municipalities = new Set(rows.map((row) => row.municipality).filter((value) => value !== "-")).size;
  const annualCustomerRevenue = sum("annualCustomerRevenue");
  const annualSupplierCost = sum("annualSupplierCost");
  const annualVimaluxMargin = annualCustomerRevenue - annualSupplierCost;
  const customerContractValue = sum("customerContractValue");
  const supplierContractCost = sum("supplierContractCost");
  const contractMargin = customerContractValue - supplierContractCost;
  return {
    rows,
    municipalities,
    projects: rows.length,
    luminaires: sum("luminaires"),
    lcus: sum("lcus"),
    annualCustomerRevenue,
    annualSupplierCost,
    annualVimaluxMargin,
    annualMarginPercent: marginPercent(annualVimaluxMargin, annualCustomerRevenue),
    customerContractValue,
    supplierContractCost,
    contractMargin,
    contractMarginPercent: marginPercent(contractMargin, customerContractValue),
    // Backward-compatible aggregate aliases used by existing dashboards.
    annualRevenue: annualCustomerRevenue,
    mrr: annualCustomerRevenue / 12,
    arr: annualCustomerRevenue,
    totalContractValue: customerContractValue,
    pipelineTcv: sum("pipelineTcv"),
    weightedTcv: sum("weightedTcv"),
  };
}

export function growthForecast(arr, annualGrowthPercent = 10, years = 5) {
  return Array.from({ length: years }, (_, index) => ({ year: index + 1, arr: arr * Math.pow(1 + annualGrowthPercent / 100, index) }));
}
