import { jsPDF } from "jspdf";
import { transformProposalCustomerText } from "./proposalCustomerVatText.js";

function currentProject() {
  try {
    const businessCaseRecordId = new URLSearchParams(window.location.search).get("business_case_id") || "";
    if (!businessCaseRecordId) return null;
    const projects = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    if (!Array.isArray(projects) || !projects.length) return null;
    return projects.find((project) => [
      project?.id,
      project?.crm?.businessCaseRecordId,
    ].map((value) => String(value || "")).includes(businessCaseRecordId)) || null;
  } catch {
    return null;
  }
}

if (!jsPDF.API.__vimaluxCustomerVatTextInstalled) {
  jsPDF.API.__vimaluxCustomerVatTextInstalled = true;
  const originalText = jsPDF.API.text;
  jsPDF.API.text = function customerAwareText(text, ...args) {
    const project = currentProject();
    if (!project) return originalText.call(this, text, ...args);
    const language = project.language === "it" ? "it" : "en";
    return originalText.call(this, transformProposalCustomerText(text, project, language), ...args);
  };
}
