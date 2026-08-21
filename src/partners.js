import { calculateBusinessCase } from "./calculations.js";
import { crmMetrics } from "./crm.js";

export function partnerProjectRows(projects = [], partner) {
  return projects.map((project) => {
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

    if (partner === "DATEK") {
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

    if (partner === "FELICITY") {
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

    // VIMALUX report: show the actual commercial result of the project,
    // including project-specific CAPEX and annual OPEX additions.
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
