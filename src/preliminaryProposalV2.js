import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabase.js";
import { warrantyLabel } from "./warranty.js";
import { qualityGateMessage, validateProposalQuality } from "./proposalQuality.js";
import {
  PDF_FONT,
  alignedTable,
  buildCustomerCapexRows,
  mergeTableHooks,
  needsNewPdfPage,
  pdfSafeText,
  reportMoney,
  reportNumber,
} from "./reportPresentation.js";

function pdfNumber(value, digits = 1, lang = "en") {
  return reportNumber(value, digits, lang);
}

function pdfMoney(value, lang = "en") {
  return reportMoney(value, lang);
}

const money = pdfMoney;
const number = pdfNumber;

function currentBusinessCaseId() {
  return new URLSearchParams(window.location.search).get("business_case_id") || "";
}

function currentBusinessCaseCode() {
  const reportMeta = document.querySelector(".report-head span")?.textContent || "";
  const match = reportMeta.match(/BC-[A-Z0-9]+/i);
  return match ? match[0].toUpperCase() : "";
}

async function loadContext() {
  const caseId = currentBusinessCaseId();
  const code = currentBusinessCaseCode();
  const { data: rows, error } = await supabase.rpc("list_business_cases");
  if (error) throw error;
  const row = caseId
    ? (rows || []).find((item) => item.id === caseId)
    : (rows || []).find((item) => String(item.business_case_code || "").toUpperCase() === code);
  if (!row) throw new Error("Business Case not found.");
  if (!row.crm_opportunity_id) throw new Error("Business Case must be linked to CRM before a proposal can be published.");
  const { data: history, error: historyError } = await supabase.rpc("get_proposal_history", { opportunity_id: row.crm_opportunity_id });
  if (historyError) throw historyError;
  const previous = (history || []).filter((item) => item.proposal_type === "preliminary" && item.source === "intelligence");
  const version = previous.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  return { row, version };
}

function filename(code, version) {
  return `VIMALUX_PRE_${String(code || "BUSINESS_CASE").replace(/[^A-Z0-9_-]/gi, "_")}_v${version}.pdf`;
}

function solutionDescription(project, it) {
  const solution = project?.solution || {};
  const parts = [it ? "upgrade a LED ad alta efficienza" : "high-efficiency LED upgrade"];
  if (solution.smartEnabled) parts.push(it ? "controllo Smart Lighting connesso" : "connected Smart Lighting control");
  if (solution.cmsEnabled) parts.push(it ? "monitoraggio CMS, allarmi e gestione remota" : "CMS monitoring, alarms and remote management");
  if (solution.powerAidEnabled) parts.push(it ? "ottimizzazione adattiva PowerAiD" : "PowerAiD adaptive optimization");
  return parts.join(", ");
}

function maintenanceSaving(project) {
  const upgraded = (project?.groups || []).reduce((sum, group) => group?.upgradeSelected === false ? sum : sum + Math.max(0, Number(group?.quantity) || 0), 0);
  const existing = Math.max(0, Number(project?.assumptions?.existingMaintenance) || 0);
  const next = Math.max(0, Number(project?.assumptions?.newMaintenance) || 0);
  return upgraded * Math.max(0, existing - next);
}

function generatePdf(row, version) {
  const project = row.intelligence_data || {};
  const result = row.result_summary || {};
  const lang = project.language === "it" ? "it" : "en";
  const it = lang === "it";
  const lineage = pdfSafeText(row.project_lineage_id || project.crm?.projectLineageId || "-");
  const code = pdfSafeText(row.business_case_code || project.project?.businessCaseId || "-");
  const customer = pdfSafeText(project.customer?.name || row.crm_fields?.customer || "-");
  const projectName = pdfSafeText(project.project?.name || row.crm_fields?.project || customer);
  const proposalId = `PRE-${code}`;
  const date = new Date().toLocaleDateString(it ? "it-IT" : "en-GB");
  const contractYears = Math.round(Number(result.contractYears) || Number(project.assumptions?.serviceAgreementPeriod) || 0);
  const powerAidYears = project.solution?.powerAidEnabled ? Math.max(1, Math.min(contractYears, Math.round(Number(project.assumptions?.powerAidServicePeriod) || 10))) : 0;
  const escalation = Number(project.assumptions?.opexEscalation) || 0;
  const annualFee = Number(result.annualCustomerPayment ?? result.annualOpex) || 0;
  const maintSaving = maintenanceSaving(project);
  const energySaving = Number(result.annualEnergySavingEUR) || 0;
  const netBenefit = Number(result.annualCustomerNetBenefit) || (energySaving + maintSaving - annualFee);
  const capexBreakdown = buildCustomerCapexRows(project, Number(result.capex) || 0, lang, result.additionalCapexSales);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const teal = [15, 118, 110];
  const navy = [15, 23, 42];
  const muted = [71, 85, 105];
  const light = [248, 250, 252];
  const section = (title, y) => {
    doc.setTextColor(...teal); doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text(pdfSafeText(title), 14, y); doc.setTextColor(...navy);
  };
  const tableHead = { fillColor: teal, font: "helvetica", fontStyle: "bold" };
  const beginSection = (title, currentY, requiredHeight) => {
    let nextY = currentY;
    if (needsNewPdfPage(nextY, requiredHeight)) {
      doc.addPage();
      nextY = 20;
    }
    section(title, nextY);
    return nextY;
  };

  doc.setFillColor(...navy); doc.rect(0, 0, 210, 48, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("VIMALUX Intelligence", 14, 17);
  doc.setFontSize(15); doc.text(it ? "Proposta Preliminare Smart Lighting" : "Preliminary Smart Lighting Proposal", 14, 29);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(`${proposalId} | v${version}  |  Project ID ${lineage}  |  ${date}`, 14, 39);

  section(it ? "Sintesi della proposta" : "Proposal Summary", 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...navy);
  const intro = it
    ? `VIMALUX presenta una proposta preliminare per ${projectName}, basata sul Business Case ${code}. La soluzione comprende ${solutionDescription(project, true)}. I valori economici sono preliminari; dimensionamento, ottiche e assegnazione definitiva dei prodotti saranno validati in VIMALUX Planner.`
    : `VIMALUX presents a preliminary proposal for ${projectName}, based on Business Case ${code}. The solution includes ${solutionDescription(project, false)}. Commercial values are preliminary; sizing, optics and final product assignment will be validated in VIMALUX Planner.`;
  doc.text(intro, 14, 68, { maxWidth: 182 });

  autoTable(doc, {
    startY: 86, theme: "grid",
    head: [[it ? "Investimento iniziale" : "Initial investment", it ? "Canone annuale Smart / CMS" : "Annual Smart / CMS fee", it ? `TCV ${contractYears} anni` : `TCV ${contractYears} years`]],
    body: [[money(result.capex, lang), money(annualFee, lang), money(result.tcv, lang)]],
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    ...alignedTable({ 0: "right", 1: "right", 2: "right" }),
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.1); doc.setTextColor(...muted);
  doc.text(it
    ? `TCV include l'indicizzazione del canone/OPEX del ${number(escalation, 1, lang)}% annuo, ove applicabile.`
    : `TCV includes ${number(escalation, 1, lang)}% annual service/OPEX escalation where applicable.`, 14, doc.lastAutoTable.finalY + 4.5);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8, theme: "grid",
    head: [[it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit", it ? "Riduzione energia" : "Energy reduction", it ? "Riduzione CO2" : "CO2 reduction", "Payback", it ? `VAN beneficio Comune (${Math.round(Number(project.assumptions?.analysisPeriod) || 0)} anni)` : `Customer-benefit NPV (${Math.round(Number(project.assumptions?.analysisPeriod) || 0)} years)`]],
    body: [[money(netBenefit, lang), `${number(result.energyReductionPct, 1, lang)}%`, `${number(result.co2ReductionTons, 1, lang)} t/${it ? "anno" : "yr"}`, result.paybackYears == null ? "-" : `${number(result.paybackYears, 1, lang)} ${it ? "anni" : "years"}`, money(result.npv, lang)]],
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 7.1, cellPadding: 2 },
    ...alignedTable({ 0: "right", 1: "right", 2: "right", 3: "right", 4: "right" }),
  });

  let y = doc.lastAutoTable.finalY + 12;
  section(it ? "Cliente e progetto" : "Customer & Project", y);
  autoTable(doc, {
    startY: y + 5, theme: "plain",
    body: [
      [it ? "Cliente / Comune" : "Customer / Municipality", customer],
      [it ? "Progetto" : "Project", projectName], ["Project ID", lineage], ["Business Case ID", code],
      [it ? "Apparecchi esistenti" : "Existing luminaires", String(Math.round(Number(result.existingLuminaires) || 0))],
      [it ? "Apparecchi da aggiornare" : "Upgrade luminaires", String(Math.round(Number(result.upgradeLuminaires) || 0))],
      ["Smart connected", String(Math.round(Number(result.smartConnectedLuminaires) || 0))],
    ],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 58, halign: "left" }, 1: { halign: "left" } },
  });

  y = doc.lastAutoTable.finalY + 9;
  section(it ? "Struttura commerciale preliminare" : "Preliminary Commercial Structure", y);
  autoTable(doc, {
    startY: y + 5, theme: "grid", head: [[it ? "Voce" : "Item", it ? "Valore" : "Value"]],
    body: [
      [it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)", money(result.capex, lang)],
      [it ? "Canone annuale Smart Lighting / CMS" : "Annual Smart Lighting / CMS fee", money(annualFee, lang)],
      [it ? "Durata CMS" : "CMS service term", `${contractYears} ${it ? "anni" : "years"}`],
      ...(project.solution?.powerAidEnabled ? [[it ? "Durata PowerAiD" : "PowerAiD service term", `${powerAidYears} ${it ? "anni" : "years"}`]] : []),
      [it ? `TCV ${contractYears} anni, indicizzato` : `Indexed TCV ${contractYears} years`, money(result.tcv, lang)],
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
    ],
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5 },
    ...alignedTable({ 0: "left", 1: "right" }),
  });

  doc.addPage();
  section(it ? "Soluzione e ambito preliminare" : "Preliminary Solution & Scope", 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(...navy);
  doc.text(it
    ? `La configurazione preliminare prevede ${solutionDescription(project, true)}. La progettazione illuminotecnica definitiva resta soggetta a validazione in Planner.`
    : `The preliminary configuration includes ${solutionDescription(project, false)}. Final lighting design remains subject to validation in Planner.`, 14, 28, { maxWidth: 182 });

  autoTable(doc, {
    startY: 39, theme: "grid", head: [[it ? "Ambito" : "Scope", it ? "Configurazione preliminare" : "Preliminary configuration"]],
    body: [
      [it ? "Upgrade LED" : "LED upgrade", `${Math.round(Number(result.upgradeLuminaires) || 0)} ${it ? "punti luce" : "lighting points"}`],
      [it ? "Controllo connesso" : "Connected control", `${Math.round(Number(result.smartConnectedLuminaires) || 0)} ${it ? "punti luce Smart" : "Smart lighting points"}`],
      ["CMS", project.solution?.cmsEnabled ? (it ? "Monitoraggio, allarmi e gestione remota" : "Monitoring, alarms and remote management") : (it ? "Non incluso" : "Not included")],
      ["Adaptive Lighting", project.solution?.powerAidEnabled ? "PowerAiD" : (it ? "Predisposizione / da validare" : "Prepared / to be validated")],
    ],
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.25 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48, halign: "left" }, 1: { halign: "left" } },
  });

  y = doc.lastAutoTable.finalY + 7;
  section(it ? "Come si genera il beneficio annuo" : "Annual benefit bridge", y);
  autoTable(doc, {
    startY: y + 4, theme: "grid", head: [[it ? "Componente" : "Component", it ? "Valore annuo" : "Annual value"]],
    body: [
      [it ? "Risparmio energia" : "Energy saving", money(energySaving, lang)],
      [it ? "Risparmio manutenzione" : "Maintenance saving", money(maintSaving, lang)],
      [it ? "Canone Smart Lighting / CMS" : "Smart Lighting / CMS fee", `(${money(annualFee, lang)})`],
      [it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit", money(netBenefit, lang)],
    ],
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.25 },
    ...alignedTable({ 0: "left", 1: "right" }),
    didParseCell: mergeTableHooks(
      alignedTable({ 0: "left", 1: "right" }).didParseCell,
      (data) => { if (data.section === "body" && data.row.index === 3) data.cell.styles.fontStyle = "bold"; },
    ),
  });

  y = doc.lastAutoTable.finalY + 7;
  y = beginSection(it ? "Composizione dell'investimento" : "Investment composition", y, 22);
  autoTable(doc, {
    startY: y + 4,
    theme: "grid",
    head: [[it ? "Voce" : "Item", it ? "Quantità" : "Quantity", it ? "Unità" : "Unit", it ? "Prezzo unitario" : "Unit price", it ? "Importo" : "Amount"]],
    body: capexBreakdown.rows,
    headStyles: tableHead,
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 6.8, cellPadding: 0.9, overflow: "linebreak" },
    columnStyles: {
      0: { halign: "left", cellWidth: 82 },
      1: { halign: "right", cellWidth: 22 },
      2: { halign: "left", cellWidth: 18 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 30 },
    },
    didParseCell: mergeTableHooks(
      alignedTable({ 0: "left", 1: "right", 2: "left", 3: "right", 4: "right" }).didParseCell,
      (data) => { if (data.section === "body" && data.row.index === capexBreakdown.rows.length - 1) data.cell.styles.fontStyle = "bold"; },
    ),
    margin: { left: 14, right: 14, bottom: 18 },
  });

  y = doc.lastAutoTable.finalY + 7;
  y = beginSection(it ? "Ipotesi principali" : "Key Assumptions", y, 48);
  autoTable(doc, {
    startY: y + 4, theme: "grid", head: [[it ? "Parametro" : "Parameter", it ? "Valore" : "Value"]],
    body: [
      [it ? "Prezzo energia" : "Energy price", `${number(project.assumptions?.energyPrice, 2, lang)} €/kWh`],
      [it ? "Ore di funzionamento annue" : "Annual operating hours", number(project.assumptions?.operatingHours, 0, lang)],
      [it ? "Periodo di analisi" : "Analysis period", `${Math.round(Number(project.assumptions?.analysisPeriod) || 0)} ${it ? "anni" : "years"}`],
      [it ? "Durata CMS" : "CMS service term", `${contractYears} ${it ? "anni" : "years"}`],
      ...(project.solution?.powerAidEnabled ? [[it ? "Durata PowerAiD" : "PowerAiD service term", `${powerAidYears} ${it ? "anni" : "years"}`]] : []),
      [it ? "Indicizzazione canone/OPEX" : "Service/OPEX escalation", `${number(escalation, 1, lang)}% ${it ? "annuo" : "p.a."}`],
      [it ? "Modello commerciale" : "Commercial model", String(project.assumptions?.dealType || project.assumptions?.financingModel || "cash")],
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
    ],
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 6.8, cellPadding: 0.9 },
    ...alignedTable({ 0: "left", 1: "right" }),
    margin: { left: 14, right: 14, bottom: 18 },
  });

  y = doc.lastAutoTable.finalY + 4;
  y = beginSection(it ? "Passaggio a VIMALUX Planner" : "Transition to VIMALUX Planner", y, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(...navy);
  doc.text(it
    ? "Prossimo passo: censimento e geolocalizzazione - classificazione UNI 11248 - dimensionamento e ottiche - BOM/logistica - proposta ufficiale Planner."
    : "Next step: census and geolocation - UNI 11248 classification - sizing and optics - BOM/logistics - official Planner proposal.", 14, y + 5, { maxWidth: 182 });
  doc.setFontSize(6.5); doc.setTextColor(...muted);
  doc.text(it
    ? `Project ID ${lineage} resterà invariato in Intelligence, Planner e CRM, preservando Business Case, versioni e cronologia.`
    : `Project ID ${lineage} remains unchanged across Intelligence, Planner and CRM, preserving the Business Case, versions and history.`, 14, y + 10, { maxWidth: 182 });

  y += 13;
  y = beginSection(it ? "Condizioni e limitazioni" : "Terms & Limitations", y, 18);
  doc.setFontSize(6.4); doc.setTextColor(...muted); doc.setFont("helvetica", "normal");
  doc.text(it
    ? "Questa proposta è indicativa e non costituisce un'offerta finale vincolante. È basata sui dati disponibili e sulle voci economiche inserite nel Business Case alla data di emissione. Prezzi, quantità, installazione, logistica, imposte, finanziamento e prestazioni definitive saranno confermati nella proposta ufficiale generata da VIMALUX Planner. IVA esclusa salvo diversa indicazione."
    : "This proposal is indicative and does not constitute a final binding quotation. It is based on available data and the economic items entered in the Business Case at the issue date. Final prices, quantities, installation, logistics, taxes, financing and performance will be confirmed in the official proposal generated by VIMALUX Planner. VAT excluded unless otherwise stated.", 14, y + 5, { maxWidth: 182 });

  const pdfName = filename(code, version);
  doc.save(pdfName);
  return pdfName;
}

function showToast(message, error = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `position:fixed;right:22px;bottom:22px;z-index:10000;max-width:620px;padding:12px 16px;border-radius:8px;color:#fff;font:600 13px/1.35 system-ui;background:${error ? "#b42318" : "#087f5b"};box-shadow:0 10px 30px rgba(15,23,42,.2)`;
  document.body.appendChild(toast); setTimeout(() => toast.remove(), error ? 8000 : 4200);
}

async function createAndPublish(button) {
  if (button.disabled) return;
  button.disabled = true;
  const original = button.textContent;
  try {
    const { row, version } = await loadContext();
    const project = row.intelligence_data || {};
    const validation = validateProposalQuality(project);
    if (!validation.ok) throw new Error(qualityGateMessage(validation, project.language === "it" ? "it" : "en"));
    button.textContent = project.language === "it" ? "Generazione..." : "Generating...";
    const pdfName = generatePdf(row, version);
    const { error } = await supabase.rpc("publish_intelligence_preliminary_proposal", {
      case_id: row.id, quotation_id: `PRE-${row.business_case_code}`, proposal_status: "draft", pdf_reference: pdfName, savings_report_reference: null,
    });
    if (error) throw error;
    showToast(project.language === "it" ? `Proposta preliminare v${version} salvata nel CRM` : `Preliminary Proposal v${version} saved to CRM`);
  } catch (error) {
    console.error("Preliminary Proposal publish failed", error);
    showToast(error?.message || "Proposal could not be published", true);
  } finally {
    button.disabled = false; button.textContent = original;
  }
}

function ensureButton() {
  const actions = document.querySelector(".report-actions");
  if (!actions || actions.querySelector("#generatePreliminaryProposalBtn")) return;
  const existing = actions.querySelector("button.primary");
  const button = document.createElement("button");
  button.id = "generatePreliminaryProposalBtn"; button.type = "button"; button.className = "primary";
  const isItalian = document.documentElement.lang === "it" || document.querySelector(".report-head h2")?.textContent?.includes("Preliminare");
  button.textContent = isItalian ? "Genera Proposta Preliminare" : "Generate Preliminary Proposal";
  button.style.marginLeft = "8px"; button.addEventListener("click", () => createAndPublish(button));
  existing?.classList.remove("primary"); actions.appendChild(button);
}

const observer = new MutationObserver(ensureButton);
observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
window.addEventListener("load", ensureButton, { once: true });
setTimeout(ensureButton, 500);

