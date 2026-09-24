import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
const autoTable = typeof autoTableModule === "function" ? autoTableModule : autoTableModule.default;
import { formatMoney, formatNumber, formatPercent } from "./i18n.js";
import { partnerProjectRows, partnerTotals } from "./partners.js";
import { PARTNER_ROLES, partnerDisplayText } from "./partnerRoles.js";
import { formatProbabilityPoints } from "./crm.js";

export function generatePartnerPdf(partner, projects, language = "it", currency = "EUR", role) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const normalized = String(partner || "").toUpperCase();
  const rows = partnerProjectRows(projects, partner, role);
  const reportRole = normalized === "VIMALUX" ? "VIMALUX" : role || rows[0]?.partnerRole;
  const isCmsPartner = reportRole === "CMS";
  const roleLabel = PARTNER_ROLES[reportRole] || "Partner";
  const label = normalized === "VIMALUX" ? "VIMALUX" : `${partnerDisplayText(partner)} · ${roleLabel}`;
  const totals = partnerTotals(projects, partner, role);
  const projectLevel = projects.length === 1;
  const money = value => formatMoney(value, language, currency);
  const pct = value => formatPercent(value, language);
  const it = language === "it";

  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 297, 38, "F");
  doc.setTextColor(255); doc.setFontSize(18); doc.text(`${label} Partner Report`, 14, 18);
  doc.setFontSize(10); doc.text(projectLevel ? `${projects[0].customer.name || projects[0].project.name} · ${projects[0].project.businessCaseId}` : `VIMALUX Intelligence · ${new Date().toISOString().slice(0,10)}`, 14, 28);
  doc.setTextColor(15,23,42);

  const summaryHead = [
    it ? "Progetti" : "Projects",
    it ? "Apparecchi" : "Luminaires",
    "LCU",
    it ? "Vendita cliente/anno" : "Customer sales/year",
    it ? "Costo fornitore/anno" : "Supplier cost/year",
    it ? "Margine VIMALUX/anno" : "VIMALUX margin/year",
    it ? "Margine %" : "Margin %",
    it ? "Valore cliente contratto" : "Customer contract value",
    it ? "Costo fornitore contratto" : "Supplier contract cost",
    it ? "Margine VIMALUX contratto" : "VIMALUX contract margin",
  ];
  const summaryBody = [[
    totals.projects,
    formatNumber(totals.luminaires,language),
    formatNumber(totals.lcus,language),
    money(totals.annualCustomerRevenue),
    money(totals.annualSupplierCost),
    money(totals.annualVimaluxMargin),
    pct(totals.annualMarginPercent),
    money(totals.customerContractValue),
    money(totals.supplierContractCost),
    money(totals.contractMargin),
  ]];
  autoTable(doc,{startY:48,head:[summaryHead],body:summaryBody,theme:"grid",headStyles:{fillColor:[15,118,110]},styles:{fontSize:7}});

  const detailHead = [
    it ? "Comune" : "Municipality",
    it ? "Progetto" : "Project",
    ...(isCmsPartner ? [it ? "Probabilità" : "Probability", "Pipeline TCV", "Weighted TCV"] : [it ? "Apparecchi" : "Luminaires", "LCU"]),
    it ? "Vendita cliente/anno" : "Customer sales/year",
    it ? "Costo fornitore/anno" : "Supplier cost/year",
    it ? "Margine VIMALUX/anno" : "VIMALUX margin/year",
    it ? "Margine %" : "Margin %",
    it ? "Valore cliente contratto" : "Customer contract value",
    it ? "Costo fornitore contratto" : "Supplier contract cost",
    it ? "Margine contratto" : "Contract margin",
  ];
  const detailBody = rows.map(row => [
    row.municipality,
    partnerDisplayText(row.project),
    ...(isCmsPartner
      ? [formatProbabilityPoints(row.probability,language),money(row.pipelineTcv),money(row.weightedTcv)]
      : [formatNumber(row.luminaires,language),formatNumber(row.lcus||0,language)]),
    money(row.annualCustomerRevenue),
    money(row.annualSupplierCost),
    money(row.annualVimaluxMargin),
    pct(row.annualMarginPercent),
    money(row.customerContractValue),
    money(row.supplierContractCost),
    money(row.contractMargin),
  ]);
  autoTable(doc,{startY:doc.lastAutoTable.finalY+10,head:[detailHead],body:detailBody,theme:"striped",headStyles:{fillColor:[15,23,42]},styles:{fontSize:6.5}});
  doc.save(`${label.replace(/[^a-z0-9]+/gi,"_")}_${projectLevel ? projects[0].project.businessCaseId : "Portfolio"}_Partner_Report.pdf`);
}
