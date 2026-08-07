import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney, formatNumber } from "./i18n.js";
import { partnerProjectRows, partnerTotals } from "./partners.js";

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
  autoTable(doc,{startY:48,head:[["Projects","Luminaires","LCUs","ARR","Contract value"]],body:[[totals.projects,formatNumber(totals.luminaires,language),formatNumber(totals.lcus,language),money(totals.arr),money(totals.totalContractValue)]],theme:"grid",headStyles:{fillColor:[15,118,110]}});
  autoTable(doc,{startY:doc.lastAutoTable.finalY+10,head:[["Municipality","Project","Luminaires","LCUs","Annual revenue","Years","Contract value"]],body:rows.map(row=>[row.municipality,row.project,formatNumber(row.luminaires,language),formatNumber(row.lcus||0,language),money(row.annualRevenue),row.contractYears,money(row.totalContractValue)]),theme:"striped",headStyles:{fillColor:[15,23,42]},styles:{fontSize:8}});
  doc.save(`${label.replace(/[^a-z0-9]+/gi,"_")}_Partner_Report.pdf`);
}
