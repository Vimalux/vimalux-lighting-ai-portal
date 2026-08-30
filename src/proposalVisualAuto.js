import { jsPDF } from "jspdf";
import { appendProposalVisualPages } from "./proposalVisualPagesSimple.js";

function businessCaseCodeFromFilename(filename) {
  return String(filename || "").match(/BC-[A-Z0-9]+/i)?.[0]?.toUpperCase() || "";
}

function proposalVersionFromFilename(filename) {
  return Number(String(filename || "").match(/_v(\d+)/i)?.[1] || 1);
}

function currentProject(filename) {
  try {
    const businessCaseRecordId = new URLSearchParams(window.location.search).get("business_case_id") || "";
    const businessCaseCode = businessCaseCodeFromFilename(filename);
    const projects = JSON.parse(localStorage.getItem("vimalux-intelligence-projects") || "[]");
    if (!Array.isArray(projects) || !projects.length) return null;

    return projects.find((project) => {
      const ids = [
        project?.id,
        project?.crm?.businessCaseRecordId,
      ].map((value) => String(value || ""));
      const codes = [
        project?.project?.businessCaseId,
        project?.crm?.businessCase?.businessCaseId,
      ].map((value) => String(value || "").toUpperCase());
      return (businessCaseRecordId && ids.includes(businessCaseRecordId)) ||
        (businessCaseCode && codes.includes(businessCaseCode));
    }) || null;
  } catch {
    return null;
  }
}

function redrawFourPageFooters(doc, project, filename) {
  const pages = doc.getNumberOfPages();
  const code = businessCaseCodeFromFilename(filename) || String(project?.project?.businessCaseId || "BUSINESS_CASE");
  const version = proposalVersionFromFilename(filename);
  const proposalId = `PRE-${code}`;
  const lineage = project?.crm?.projectLineageId || project?.project?.projectLineageId || "-";
  const it = project?.language === "it";

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 278, 210, 19, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(14, 281, 196, 281);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`${proposalId} v${version}  |  ${lineage}  |  VIMALUX Intelligence`, 14, 286);
    doc.text(`${it ? "Pagina" : "Page"} ${page}/${pages}`, 188, 286, { align: "right" });
  }
}

function downloadPdf(doc, filename) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "VIMALUX_Preliminary_Proposal.pdf";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return doc;
}

if (!jsPDF.API.__vimaluxPreliminaryVisualsInstalled) {
  jsPDF.API.__vimaluxPreliminaryVisualsInstalled = true;
  jsPDF.API.save = function patchedSave(filename) {
    const isPreliminary = /^VIMALUX_PRE_/i.test(String(filename || ""));
    if (isPreliminary && !this.__vimaluxVisualPagesAdded) {
      const project = currentProject(filename);
      if (!project) {
        throw new Error("Impossibile associare il PDF al Business Case attivo. Nessun dato viene generato da un progetto diverso.");
      }
      this.__vimaluxVisualPagesAdded = true;
      appendProposalVisualPages(this, project, {
        lang: project.language === "it" ? "it" : "en",
        teal: [15, 118, 110],
        navy: [15, 23, 42],
        muted: [71, 85, 105],
        light: [248, 250, 252],
      });
      redrawFourPageFooters(this, project, filename);
    }
    return downloadPdf(this, filename);
  };
}
