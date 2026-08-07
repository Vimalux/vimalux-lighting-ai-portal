import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, formatNumber } from "./i18n.js";
import { partnerProjectRows, partnerTotals } from "./partners.js";
import { formatProbabilityPoints } from "./crm.js";

export function generatePartnerPdf(partner, projects, language = "it", currency = "EUR") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const label = partner === "FELICITY" ? "Felicity / PowerAiD" : partner;
  const rows = partnerProjectRows(projects, partner);
  const totals = partnerTotals(projects, partner);
  const money = value => formatMoney(value, language, currency);
  doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 38, "F");
  doc.setTextColor(255); doc.setFontSize(18); doc.text(`${label} Partner Report`, 14, 18);
  doc.setFontSize(10); doc.text(`VIMALUX Intelligence · ${new Date().toISOString().slice(0,10)}`, 14, 28);
  doc.setTextColor(15,23,42);
  const datek = partner === "DATEK";
  const summaryHead = datek ? ["Projects","Luminaires","LCUs","Pipeline TCV","Weighted TCV","ARR","CMS contract value"] : ["Projects","Luminaires","LCUs","ARR","Contract value"];
  const summaryBody = datek ? [totals.projects,formatNumber(totals.luminaires,language),formatNumber(totals.lcus,language),money(totals.pipelineTcv),money(totals.weightedTcv),money(totals.arr),money(totals.totalContractValue)] : [totals.projects,formatNumber(totals.luminaires,language),formatNumber(totals.lcus,language),money(totals.arr),money(totals.totalContractValue)];
  autoTable(doc,{startY:48,head:[summaryHead],body:[summaryBody],theme:"grid",headStyles:{fillColor:[15,118,110]},styles:{fontSize:8}});
  const detailHead = datek ? ["Municipality","Project","Probability","Pipeline TCV","Weighted TCV","Annual CMS","Years","CMS contract value"] : ["Municipality","Project","Luminaires","LCUs","Annual revenue","Years","Contract value"];
  const detailBody = datek ? rows.map(row=>[row.municipality,row.project,formatProbabilityPoints(row.probability,language),money(row.pipelineTcv),money(row.weightedTcv),money(row.annualRevenue),row.contractYears,money(row.totalContractValue)]) : rows.map(row=>[row.municipality,row.project,formatNumber(row.luminaires,language),formatNumber(row.lcus||0,language),money(row.annualRevenue),row.contractYears,money(row.totalContractValue)]);
  autoTable(doc,{startY:doc.lastAutoTable.finalY+10,head:[detailHead],body:detailBody,theme:"striped",headStyles:{fillColor:[15,23,42]},styles:{fontSize:7}});
  doc.save(`${label.replace(/[^a-z0-9]+/gi,"_")}_Partner_Report.pdf`);
}
