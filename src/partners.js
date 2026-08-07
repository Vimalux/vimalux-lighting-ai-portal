import { calculateBusinessCase } from "./calculations.js";

export function partnerProjectRows(projects = [], partner) {
  return projects.map((project) => {
    const result = calculateBusinessCase(project);
    const years = Math.max(1, Math.round(Number(project.assumptions.contractYears) || 1));
    const common = { id: project.id, municipality: project.customer.name || "-", project: project.project.name || "-", luminaires: result.totalQuantity, contractYears: years };
    if (partner === "DATEK") return { ...common, lcus: result.lcuQuantity, annualRevenue: result.cmsRevenue, mrr: result.cmsRevenue / 12, arr: result.cmsRevenue, totalContractValue: result.contractOpexRevenue && result.cmsRevenue ? Array.from({length: years}, (_, i) => result.cmsRevenue * Math.pow(1 + Number(project.assumptions.opexEscalation || 0) / 100, i)).reduce((a,b)=>a+b,0) : 0 };
    if (partner === "FELICITY") return { ...common, annualRevenue: result.savingsAsAServiceRevenue, mrr: result.savingsAsAServiceRevenue / 12, arr: result.savingsAsAServiceRevenue, totalContractValue: result.savingsAsAServiceRevenue * years };
    return { ...common, annualRevenue: result.totalCapex, mrr: 0, arr: 0, totalContractValue: result.totalCapex };
  });
}

export function partnerTotals(projects, partner) {
  const rows = partnerProjectRows(projects, partner);
  const sum = (key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const municipalities = new Set(rows.map(row => row.municipality).filter(value => value !== "-")).size;
  return { rows, municipalities, projects: rows.length, luminaires: sum("luminaires"), lcus: sum("lcus"), annualRevenue: sum("annualRevenue"), mrr: sum("mrr"), arr: sum("arr"), totalContractValue: sum("totalContractValue") };
}

export function growthForecast(arr, annualGrowthPercent = 10, years = 5) {
  return Array.from({ length: years }, (_, index) => ({ year: index + 1, arr: arr * Math.pow(1 + annualGrowthPercent / 100, index) }));
}
