import { calculateBusinessCase } from "./calculations.js";
import { crmMetrics } from "./crm.js";

// Kept for backwards compatibility. New UI must derive partner options from
// the Smart/CMS master catalogue via cmsPartnerOptions().
export const CMS_PARTNERS = [];

const partnerName = (value) => String(value || "").trim().toUpperCase();

export function cmsPartnerOptions(source = []) {
  const projects = Array.isArray(source) ? source : [source];
  const names = projects.flatMap((project) =>
    (project?.catalogue?.smart || []).flatMap((item) => [
      item?.cmsPartner,
      item?.vendor,
      item?.supplier,
    ]),
  ).map(partnerName).filter(Boolean);
  return [...new Set(names)].sort();
}

export function resolveCmsPartner(project) {
  const selectedLcu = (project?.catalogue?.smart || []).find(
    (item) => item.id === project?.solution?.lcuProductId,
  );

  // The selected Smart/CMS product is authoritative. This means changing the
  // master product vendor immediately changes the partner classification of
  // every Business Case using that Product ID.
  const selectedPartner = [
    selectedLcu?.cmsPartner,
    selectedLcu?.vendor,
    selectedLcu?.supplier,
  ].map(partnerName).find(Boolean);
  if (selectedPartner) return selectedPartner;

  // Explicit project value remains a fallback for legacy/manual projects that
  // do not yet reference a catalogue product with partner master data.
  const explicit = partnerName(project?.solution?.cmsPartner);
  if (explicit) return explicit;

  // Last-resort legacy fallback: old VIMALUX Smart products represented DATEK
  // before Partner/Vendor became a catalogue master-data field.
  if (project?.solution?.smartEnabled && project?.solution?.cmsEnabled) return "DATEK";
  return "";
}

export function partnerProjectRows(projects = [], partner) {
  const normalizedPartner = partnerName(partner);
  const isCmsPartner = !["VIMALUX", "FELICITY"].includes(normalizedPartner);
  const sourceProjects = isCmsPartner
    ? projects.filter((project) => {
        if (!project.solution?.smartEnabled || !project.solution?.cmsEnabled) return false;
        return resolveCmsPartner(project) === normalizedPartner;
      })
    : projects;
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
        totalContractValue:
          result.contractOpexRevenue && result.cmsRevenue
            ? Array.from(
                { length: years },
                (_, i) =>
                  result.cmsRevenue *
                  Math.pow(
                    1 + Number(project.assumptions.opexEscalation || 0) / 100,
                    i,
                  ),
              ).reduce((a, b) => a + b, 0)
            : 0,
      };
    }

    if (normalizedPartner === "FELICITY") {
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
  const sum = (key) =>
    rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const municipalities = new Set(
    rows.map((row) => row.municipality).filter((value) => value !== "-"),
  ).size;
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
  return Array.from({ length: years }, (_, index) => ({
    year: index + 1,
    arr: arr * Math.pow(1 + annualGrowthPercent / 100, index),
  }));
}
