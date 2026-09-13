const ROOT_SELECTOR = ".customer-value-chart";

function localProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch {
    return [];
  }
}

function activeProject(projects) {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("business_case_id") || "";
  const visibleCode = String(document.querySelector("main header small")?.textContent || "").trim();
  return projects.find((project) =>
    (caseId && [project?.id, project?.crm?.businessCaseRecordId].map(String).includes(caseId)) ||
    (visibleCode && String(project?.project?.businessCaseId || "").trim() === visibleCode)
  ) || projects[0] || null;
}

function serviceYearsFor(project) {
  const value = Number(project?.assumptions?.serviceAgreementPeriod || project?.assumptions?.contractYears || 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function isNoleggioProject(project) {
  const dealType = String(project?.assumptions?.dealType || "").toLowerCase();
  const financingModel = String(project?.assumptions?.financingModel || "").toLowerCase();
  return dealType === "noleggio_operativo" || ["laas", "noleggio_operativo", "ppp"].includes(financingModel);
}

function phaseRange(node) {
  const label = String(node.querySelector("strong")?.textContent || "");
  const match = label.match(/(\d+)\s*[–-]\s*(\d+)|(?:Anni|Years)\s*(\d+)/i);
  if (!match) return null;
  if (match[1] && match[2]) return { start: Number(match[1]), end: Number(match[2]) };
  if (match[3]) return { start: Number(match[3]), end: Number(match[3]) };
  return null;
}

function patchChart(chart, serviceYears, it, isNoleggio) {
  if (!chart) return;
  const title = chart.querySelector("h3");
  const desiredTitle = it
    ? `Evoluzione dei costi e dei risparmi - ${serviceYears} anni`
    : `Cost and savings development - ${serviceYears} years`;
  if (title && title.textContent !== desiredTitle) title.textContent = desiredTitle;

  chart.querySelectorAll(".value-period-phase").forEach((phase) => {
    const range = phaseRange(phase);
    if (!range) return;
    if (range.start > serviceYears) {
      phase.remove();
      return;
    }
    if (range.end > serviceYears) {
      const label = phase.querySelector("strong");
      if (label) label.textContent = `${it ? "Anni" : "Years"} ${range.start}–${serviceYears}`;
      phase.style.flexGrow = String(Math.max(1, serviceYears - range.start + 1));
    }
    if (isNoleggio) {
      const stateLabel = [...phase.children].find((child) => child.tagName === "SPAN" && !child.classList.contains("value-summary-bar"));
      const desired = it ? "Pagamento all-inclusive" : "All-inclusive payment";
      if (stateLabel && stateLabel.textContent !== desired) stateLabel.textContent = desired;
    }
  });
}

function patchCashflowTable(serviceYears, it) {
  const section = document.querySelector(".advanced-customer-economics.cashflow-visible");
  if (!section) return;
  const rows = [...section.querySelectorAll("tbody tr")];
  rows.forEach((row) => {
    const year = Number(String(row.querySelector("td")?.textContent || "").trim());
    if (Number.isFinite(year) && year > serviceYears) row.remove();
  });

  const hint = section.querySelector(".hint");
  if (hint) {
    const desired = it
      ? `Dettaglio annuale limitato al periodo contrattuale/servizi di ${serviceYears} anni, con beneficio lordo, OPEX, pagamento e flusso netto cliente.`
      : `Annual detail limited to the ${serviceYears}-year contract/service period, with gross benefit, OPEX, payment and customer net cash flow.`;
    if (hint.textContent !== desired) hint.textContent = desired;
  }
}

function patchReportHorizon() {
  const project = activeProject(localProjects());
  const serviceYears = serviceYearsFor(project);
  if (!project || !serviceYears) return;
  const it = project?.language !== "en";
  const isNoleggio = isNoleggioProject(project);
  patchChart(document.querySelector(ROOT_SELECTOR), serviceYears, it, isNoleggio);
  patchCashflowTable(serviceYears, it);
}

if (typeof document !== "undefined") {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      patchReportHorizon();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
}
