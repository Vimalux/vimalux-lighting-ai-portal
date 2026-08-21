const STORAGE_KEY = "vimalux-intelligence-projects";

const n = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readProjects = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const activeProject = () => {
  const caseId = document.querySelector("main > header small")?.textContent?.trim();
  const projects = readProjects();
  return projects.find((project) =>
    project?.project?.businessCaseId === caseId ||
    project?.id === caseId ||
    project?.crm?.businessCaseRecordId === caseId,
  ) || null;
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
  const rows = (project.additionalCosts || []).filter((item) => item?.costType === type && n(item.quantity) * n(item.unitSalesPrice) > 0);
  if (!rows.length) return null;

  const wrapper = document.createElement("div");
  wrapper.dataset.additionalCostsSummary = type;
  wrapper.className = "additional-costs-solution-summary";

  const title = document.createElement("p");
  title.className = "hint additional-costs-solution-title";
  title.innerHTML = `<strong>${
    type === "capex"
      ? (it ? "Costi aggiuntivi CAPEX" : da ? "Ekstra CAPEX-omkostninger" : "Additional CAPEX costs")
      : (it ? "Costi aggiuntivi OPEX annuali" : da ? "Ekstra årlige OPEX-omkostninger" : "Additional annual OPEX costs")
  }</strong>`;
  wrapper.appendChild(title);

  const breakdown = document.createElement("div");
  breakdown.className = "breakdown";
  rows.forEach((item) => {
    const quantity = n(item.quantity);
    const unitPrice = n(item.unitSalesPrice);
    const total = quantity * unitPrice;
    const row = document.createElement("div");
    const label = item.description?.trim() || (it ? "Costo aggiuntivo" : da ? "Ekstra omkostning" : "Additional cost");
    row.innerHTML = `<span>${label}</span><span>${quantity} ${item.unit || ""} × ${formatter.format(unitPrice)}</span><strong>${formatter.format(total)}</strong>`;
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
