import { readRuntimeProjects } from "./runtimeProjectStore.js";
import { resolveActiveProjectIndex } from "./activeBusinessCaseResolver.js";
import { solutionAdditionalCostRows } from "./solutionAdditionalCostsData.js";

const readProjects = readRuntimeProjects;

const activeProject = () => {
  const projects = readProjects();
  const index = resolveActiveProjectIndex(projects, {
    urlBusinessCaseId: new URLSearchParams(window.location.search).get("business_case_id"),
    headerText: document.querySelector("main > header small")?.textContent || "",
  });
  return projects[index] || null;
};

const currencyFormatter = (project) => new Intl.NumberFormat(
  project?.language === "it" ? "it-IT" : project?.language === "da" ? "da-DK" : "en-GB",
  {
    style: "currency",
    currency: project?.project?.currency || "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  },
);

const makeSection = (project, type, formatter) => {
  const it = project.language === "it";
  const da = project.language === "da";
  const rows = solutionAdditionalCostRows(project, type);
  if (!rows.length) return null;

  const wrapper = document.createElement("div");
  wrapper.dataset.additionalCostsSummary = type;
  wrapper.className = "additional-costs-solution-summary";

  const title = document.createElement("p");
  title.className = "hint additional-costs-solution-title";
  const heading = document.createElement("strong");
  heading.textContent =
    type === "capex"
      ? (it ? "Costi aggiuntivi CAPEX" : da ? "Ekstra CAPEX-omkostninger" : "Additional CAPEX costs")
      : (it ? "Costi aggiuntivi OPEX annuali" : da ? "Ekstra årlige OPEX-omkostninger" : "Additional annual OPEX costs");
  title.appendChild(heading);
  wrapper.appendChild(title);

  const breakdown = document.createElement("div");
  breakdown.className = "breakdown";
  rows.forEach((item) => {
    const row = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = item.description;
    const detail = document.createElement("span");
    detail.textContent = `${item.quantity} ${item.unit || ""} × ${formatter.format(item.unitSalesPrice)}`;
    const total = document.createElement("strong");
    total.textContent = formatter.format(item.salesTotal);
    row.append(label, detail, total);
    breakdown.appendChild(row);
  });
  wrapper.appendChild(breakdown);
  return wrapper;
};

const enhance = () => {
  const project = activeProject();
  if (!project) return;

  const cards = [...document.querySelectorAll("section.card")];
  const card = cards.find((candidate) => {
    const title = candidate.querySelector("h2")?.textContent?.trim();
    return ["Riepilogo soluzione utilizzata", "Used solution summary"].includes(title);
  });
  if (!card) return;

  const capexRows = solutionAdditionalCostRows(project, "capex");
  const opexRows = solutionAdditionalCostRows(project, "opex_annual");
  const signature = JSON.stringify({ projectId: project.id, capexRows, opexRows });
  if (card.dataset.additionalCostsSignature === signature
      && Boolean(card.querySelector('[data-additional-costs-summary="capex"]')) === Boolean(capexRows.length)
      && Boolean(card.querySelector('[data-additional-costs-summary="opex_annual"]')) === Boolean(opexRows.length)) return;
  card.dataset.additionalCostsSignature = signature;
  card.querySelectorAll("[data-additional-costs-summary]").forEach((node) => node.remove());
  const formatter = currencyFormatter(project);
  const summaryLines = [...card.querySelectorAll(":scope > .summary-line")];

  const capexTotal = summaryLines.find((line) => line.querySelector("span")?.textContent?.trim() === "CAPEX");
  const capexSection = makeSection(project, "capex", formatter);
  if (capexSection && capexTotal) card.insertBefore(capexSection, capexTotal);

  const opexTarget = summaryLines.find((line) => {
    const text = line.querySelector("span")?.textContent || "";
    return text.includes("OPEX annuo fisso") || text.includes("Fixed annual OPEX");
  });
  const opexSection = makeSection(project, "opex_annual", formatter);
  if (opexSection && opexTarget) card.insertBefore(opexSection, opexTarget);
};

let scheduled = false;
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    enhance();
  });
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();
}
