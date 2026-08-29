import { jsPDF } from "jspdf";
import { appendProposalVisualPages } from "./proposalVisualPages.js";

function currentProject() {
  try {
    const businessCaseId = new URLSearchParams(window.location.search).get("business_case_id") || "";
    const projects = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    if (!Array.isArray(projects) || !projects.length) return null;
    return projects.find((project) =>
      String(project?.id || "") === businessCaseId ||
      String(project?.crm?.businessCaseRecordId || "") === businessCaseId ||
      String(project?.project?.businessCaseId || "") === businessCaseId
    ) || projects[0] || null;
  } catch {
    return null;
  }
}

const originalSave = jsPDF.API.save;

if (!jsPDF.API.__vimaluxPreliminaryVisualsInstalled) {
  jsPDF.API.__vimaluxPreliminaryVisualsInstalled = true;
  jsPDF.API.save = function patchedSave(filename, ...args) {
    const isPreliminary = /^VIMALUX_PRE_/i.test(String(filename || ""));
    if (isPreliminary && !this.__vimaluxVisualPagesAdded) {
      const project = currentProject();
      if (project) {
        this.__vimaluxVisualPagesAdded = true;
        appendProposalVisualPages(this, project, {
          lang: project.language === "it" ? "it" : "en",
          teal: [15, 118, 110],
          navy: [15, 23, 42],
          muted: [71, 85, 105],
          light: [248, 250, 252],
        });
      }
    }
    return originalSave.call(this, filename, ...args);
  };
}
