import { calculateBusinessCase } from "./calculations.js";
import { crmMetrics } from "./crm.js";

// Kept for backwards compatibility. Partner options are derived from catalogue master data.
export const CMS_PARTNERS = [];

const partnerName = (value) => String(value || "").trim().toUpperCase();
const smartType = (item) => String(item?.type || "").trim().toUpperCase();
const isAdaptiveProduct = (item) => smartType(item) === "OTHER" || String(item?.partnerRole || "").toUpperCase() === "ADAPTIVE_DIMMING";
const isCmsProduct = (item) => !isAdaptiveProduct(item) && ["LCU", "GATEWAY", "ANTENNA", "ENERGY METER", "CMS"].includes(smartType(item));

export function cmsPartnerOptions(source = []) {
  const projects = Array.isArray(source) ? source : [source];
  const names = projects.flatMap((project) =>
    (project?.catalogue?.smart || [])
      .filter((item) => item?.active !== false && isCmsProduct(item))
      .flatMap((item) => [item?.cmsPartner, item?.vendor, item?.supplier]),
  ).map(partnerName).filter(Boolean);
  return [...new Set(names)].sort();
}

export function adaptiveDimmingPartnerOptions(source = []) {
  const projects = Array.isArray(source) ? source : [source];
  const names = projects.flatMap((project) =>
    (project?.catalogue?.smart || [])
      .filter((item) => item?.active !== false && isAdaptiveProduct(item))
      .flatMap((item) => [item?.supplier, item?.vendor]),
  ).map(partnerName).filter(Boolean);
  return [...new Set(names)].sort();
}

export function technologyPartnerOptions(source = []) {
  return [...new Set([...cmsPartnerOptions(source), ...adaptiveDimmingPartnerOptions(source)])].sort();
}

export function resolveCmsPartner(project) {
  const selectedLcu = (project?.catalogue?.smart || []).find(
    (item) => item.id === project?.solution?.lcuProductId,
  );
  const selectedPartner = [selectedLcu?.cmsPartner, selectedLcu?.vendor, selectedLcu?.supplier]
    .map(partnerName)
    .find(Boolean);
  if (selectedPartner) return selectedPartner;
  const explicit = partnerName(project?.solution?.cmsPartner);
  if (explicit && cmsPartnerOptions(project).includes(explicit)) return explicit;
  if (project?.solution?.smartEnabled && project?.solution?.cmsEnabled) return cmsPartnerOptions(project)[0] || "DATEK";
  return "";
}

export function resolveAdaptiveDimmingPartner(project) {
  if (!project?.solution?.powerAidEnabled) return "";
  const explicit = partnerName(project?.solution?.adaptiveDimmingPartner);
  if (explicit) return explicit;
  const selectedIds = new Set((project?.solution?.partnerEquipment || []).map((row) => row?.productId).filter(Boolean));
  const selected = (project?.catalogue?.smart || []).find((item) => selectedIds.has(item.id) && isAdaptiveProduct(item));
  return partnerName(selected?.supplier || selected?.vendor);
}

export function partnerProjectRows(projects = [], partner) {
  const normalizedPartner = partnerName(partner);
  const cmsPartners = new Set(cmsPartnerOptions(projects));
  const adaptivePartners = new Set(adaptiveDimmingPartnerOptions(projects));
  const isCmsPartner = cmsPartners.has(normalizedPartner);
  const isAdaptivePartner = adaptivePartners.has(normalizedPartner);
  const sourceProjects = normalizedPartner === "VIMALUX"
    ? projects
    : isCmsPartner
      ? projects.filter((project) => project.solution?.smartEnabled && project.solution?.cmsEnabled && resolveCmsPartner(project) === normalizedPartner)
      : isAdaptivePartner
        ? projects.filter((project) => project.solution?.powerAidEnabled && resolveAdaptiveDimmingPartner(project) === normalizedPartner)
        : [];

  return sourceProjects.map((project) => {
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
      partnerRole: isCmsPartner ? "CMS" : isAdaptivePartner ? "ADAPTIVE_DIMMING" : "VIMALUX",
    };

    if (isCmsPartner) {
      return {
        ...common,
        probability: crm.probability,
        pipelineTcv: crm.totalContractValue,
        weightedTcv: crm.weightedTcv,
        annualRevenue: result.cmsRevenue,
        mrr: result.cmsRevenue / 12,
        arr: result.cmsRevenue,
        totalContractValue: result.contractOpexRevenue && result.cmsRevenue
          ? Array.from({ length: years }, (_, i) => result.cmsRevenue * Math.pow(1 + Number(project.assumptions.opexEscalation || 0) / 100, i)).reduce((a, b) => a + b, 0)
          : 0,
      };
    }

    if (isAdaptivePartner) {
      return {
        ...common,
        annualRevenue: result.powerAidSupplierCost,
        mrr: result.powerAidSupplierCost / 12,
        arr: result.powerAidSupplierCost,
        customerFee: result.powerAidCustomerFee,
        vimaluxMargin: result.powerAidVimaluxMargin,
        totalContractValue: result.powerAidSupplierContractCost,
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

export function partnerTotals(projects, partner) {
  const rows = partnerProjectRows(projects, partner);
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
