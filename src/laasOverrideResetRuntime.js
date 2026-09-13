import { migrateProject } from "./model.js";
import { saveCloudState, supabaseConfigured } from "./supabase.js";

const RESET_ID = "vimalux-laas-override-reset";

function localProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch {
    return [];
  }
}

function activeIndex(projects) {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("business_case_id") || "";
  const visibleCode = String(document.querySelector("main header small")?.textContent || "").trim();
  return projects.findIndex((project) =>
    (caseId && [project?.id, project?.crm?.businessCaseRecordId].map(String).includes(caseId)) ||
    (visibleCode && String(project?.project?.businessCaseId || "").trim() === visibleCode)
  );
}

function overrideField() {
  return [...document.querySelectorAll("label")].find((label) =>
    /canone\s+mensile\s+tutto\s+incluso.*override|monthly\s+all-inclusive\s+payment.*override/i.test(
      String(label.textContent || "").replace(/\s+/g, " ").trim()
    )
  );
}

async function resetOverride(button) {
  const projects = localProjects();
  const index = activeIndex(projects);
  if (index < 0) return;
  const project = projects[index];
  button.disabled = true;
  button.textContent = project?.language === "en" ? "Restoring..." : "Ripristino...";

  projects[index] = migrateProject({
    ...project,
    assumptions: {
      ...(project.assumptions || {}),
      allInclusiveAnnualPayment: 0,
    },
    updatedAt: new Date().toISOString(),
  });

  localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects));
  if (supabaseConfigured) await saveCloudState(projects);
  window.location.reload();
}

function render() {
  const field = overrideField();
  if (!field) {
    document.getElementById(RESET_ID)?.remove();
    return;
  }

  const input = field.querySelector("input");
  if (!input) return;

  let button = document.getElementById(RESET_ID);
  if (!button) {
    button = document.createElement("button");
    button.id = RESET_ID;
    button.type = "button";
    button.className = "secondary";
    button.style.cssText = "justify-self:start;margin-top:2px;padding:7px 10px;font-size:12px";
    button.textContent = /canone\s+mensile/i.test(field.textContent || "")
      ? "Ripristina calcolo automatico"
      : "Restore automatic calculation";
    button.addEventListener("click", async () => {
      try {
        await resetOverride(button);
      } catch (error) {
        button.disabled = false;
        button.textContent = error?.message || "Errore";
      }
    });
    field.appendChild(button);
  }

  const numeric = Number(String(input.value || "").replace(/\./g, "").replace(",", ".")) || 0;
  button.disabled = numeric <= 0;
}

function schedule() {
  [0, 80, 250].forEach((delay) => setTimeout(render, delay));
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("input", schedule, true);
  document.addEventListener("change", schedule, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule, { once: true });
  else schedule();
}
