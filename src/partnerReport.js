import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : autoTableModule.default;
import { formatMoney, formatNumber } from "./i18n.js";
import { partnerProjectRows, partnerTotals } from "./partners.js";
import { PARTNER_ROLES, partnerDisplayText } from "./partnerRoles.js";
import { formatProbabilityPoints } from "./crm.js";

export function generatePartnerPdf(partner, projects, language = "it", currency = "EUR", role) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const normalized = String(partner || "").toUpperCase();
  const rows = partnerProjectRows(projects, partner, role);
  const reportRole = normalized === "VIMALUX" ? "VIMALUX" : role || rows[0]?.partnerRole;
  const isCmsPartner = reportRole === "CMS";
  const isAdaptivePartner = reportRole === "ADAPTIVE_DIMMING";
  const roleLabel = PARTNER_ROLES[reportRole] || "Partner";
  const label = normalized === "VIMALUX" ? "VIMALUX" : `${partnerDisplayText(partner)} · ${roleLabel}`;
  const totals = partnerTotals(projects, partner, role);
  const projectLevel = projects.length === 1;
  const money = value => formatMoney(value, language, currency);
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255); doc.setFontSize(18); doc.text(`${label} Partner Report`, 14, 18);
  doc.setFontSize(10); doc.text(projectLevel ? `${projects[0].customer.name || projects[0].project.name} · ${projects[0].project.businessCaseId}` : `VIMALUX Intelligence · ${new Date().toISOString().slice(0,10)}`, 14, 28);
  doc.setTextColor(15,23,42);
  const summaryHead = isCmsPartner
    ? ["Projects","Luminaires","LCUs","Pipeline TCV","Weighted TCV","ARR","CMS contract value"]
    : ["Projects","Luminaires","LCUs","ARR","Contract value"];
  const summaryBody = isCmsPartner
    ? [totals.projects,formatNumber(totals.luminaires,language),formatNumber(totals.lcus,language),money(totals.pipelineTcv),money(totals.weightedTcv),money(totals.arr),money(totals.totalContractValue)]
    : [totals.projects,formatNumber(totals.luminaires,language),formatNumber(totals.lcus,language),money(totals.arr),money(totals.totalContractValue)];
  autoTable(doc,{startY:48,head:[summaryHead],body:[summaryBody],theme:"grid",headStyles:{fillColor:[15,118,110]},styles:{fontSize:8}});
  const detailHead = isCmsPartner
    ? ["Municipality","Project","Probability","Pipeline TCV","Weighted TCV","Annual CMS","Years","CMS contract value"]
    : ["Municipality","Project","Luminaires","LCUs",isAdaptivePartner ? "Adaptive Dimming annual value" : "Annual revenue","Years","Contract value"];
  const detailBody = isCmsPartner
    ? rows.map(row=>[row.municipality,partnerDisplayText(row.project),formatProbabilityPoints(row.probability,language),money(row.pipelineTcv),money(row.weightedTcv),money(row.annualRevenue),row.contractYears,money(row.totalContractValue)])
    : rows.map(row=>[row.municipality,row.project,formatNumber(row.luminaires,language),formatNumber(row.lcus||0,language),money(row.annualRevenue),row.contractYears,money(row.totalContractValue)]);
  autoTable(doc,{startY:doc.lastAutoTable.finalY+10,head:[detailHead],body:detailBody,theme:"striped",headStyles:{fillColor:[15,23,42]},styles:{fontSize:7}});
  doc.save(`${label.replace(/[^a-z0-9]+/gi,"_")}_${projectLevel ? projects[0].project.businessCaseId : "Portfolio"}_Partner_Report.pdf`);
}
