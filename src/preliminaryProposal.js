import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabase.js";
import { warrantyLabel } from "./warranty.js";

const money = (value, lang = "en") => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
}).format(Number(value) || 0);
const number = (value, digits = 1, lang = "en") => new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}).format(Number(value) || 0);

function currentBusinessCaseCode() {
  const reportMeta = document.querySelector(".report-head span")?.textContent || "";
  const match = reportMeta.match(/BC-[A-Z0-9]+/i);
  if (match) return match[0].toUpperCase();
  const selected = document.querySelector(".project-row.selected small, .project-select.selected small")?.textContent || "";
  const selectedMatch = selected.match(/BC-[A-Z0-9]+/i);
  return selectedMatch ? selectedMatch[0].toUpperCase() : "";
}

async function loadContext() {
  const code = currentBusinessCaseCode();
  if (!code) throw new Error("Business Case ID not found.");
  const { data: rows, error } = await supabase.rpc("list_business_cases");
  if (error) throw error;
  const row = (rows || []).find(item => String(item.business_case_code || "").toUpperCase() === code);
  if (!row) throw new Error(`Business Case ${code} not found.`);
  if (!row.crm_opportunity_id) throw new Error("Business Case must be linked to CRM before a proposal can be published.");
  const { data: history, error: historyError } = await supabase.rpc("get_proposal_history", { opportunity_id: row.crm_opportunity_id });
  if (historyError) throw historyError;
  const previous = (history || []).filter(item => item.proposal_type === "preliminary" && item.source === "intelligence");
  const version = previous.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  return { row, version };
}

function proposalFilename(code, version) {
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

function scopeRows(project, result, it) {
  const solution = project?.solution || {};
  return [
    [it ? "Upgrade LED" : "LED upgrade", `${Math.round(Number(result.upgradeLuminaires) || 0)} ${it ? "punti luce" : "lighting points"}`],
    [it ? "Controllo connesso" : "Connected control", solution.smartEnabled ? `${Math.round(Number(result.smartConnectedLuminaires) || 0)} ${it ? "punti luce Smart" : "Smart lighting points"}` : (it ? "Non incluso" : "Not included")],
    ["CMS", solution.cmsEnabled ? (it ? "Monitoraggio, allarmi e gestione remota" : "Monitoring, alarms and remote management") : (it ? "Non incluso" : "Not included")],
    ["Adaptive Lighting", solution.powerAidEnabled ? "PowerAiD" : (it ? "Predisposizione / da validare" : "Prepared / to be validated")],
  ];
}

function drawFooter(doc, pages, proposalId, version, lineage, it, muted) {
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 281, 196, 281);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`${proposalId} v${version}  |  ${lineage}  |  VIMALUX Intelligence`, 14, 286);
    doc.text(`${it ? "Pagina" : "Page"} ${page}/${pages}`, 188, 286, { align: "right" });
  }
}

function generatePdf(row, version) {
  const project = row.intelligence_data || {};
  const result = row.result_summary || {};
  const lang = project.language === "it" ? "it" : "en";
  const it = lang === "it";
  const lineage = row.project_lineage_id || project.crm?.projectLineageId || "-";
  const code = row.business_case_code || project.project?.businessCaseId || "-";
  const customer = project.customer?.name || row.crm_fields?.customer || "-";
  const projectName = project.project?.name || row.crm_fields?.project || customer;
  const proposalId = `PRE-${code}`;
  const date = new Date().toLocaleDateString(it ? "it-IT" : "en-GB");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const teal = [15, 118, 110];
  const navy = [15, 23, 42];
  const muted = [71, 85, 105];
  const pale = [240, 253, 250];
  const light = [248, 250, 252];
  const section = (title, y) => {
    doc.setTextColor(...teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, y);
    doc.setTextColor(...navy);
  };

  // PAGE 1 — summary and commercial structure
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 48, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("VIMALUX Intelligence", 14, 17);
  doc.setFontSize(15); doc.text(it ? "Proposta Preliminare Smart Lighting" : "Preliminary Smart Lighting Proposal", 14, 29);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text(`${proposalId} · v${version}  |  Project ID ${lineage}  |  ${date}`, 14, 39);

  section(it ? "Sintesi della proposta" : "Proposal Summary", 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...navy);
  const intro = it
    ? `VIMALUX presenta una proposta preliminare per ${projectName}, basata sul Business Case ${code}. La soluzione proposta comprende ${solutionDescription(project, true)}. I valori sono preliminari e saranno validati tecnicamente in VIMALUX Planner prima della proposta definitiva.`
    : `VIMALUX presents a preliminary proposal for ${projectName}, based on Business Case ${code}. The proposed solution includes ${solutionDescription(project, false)}. Values are preliminary and will be technically validated in VIMALUX Planner before the final proposal.`;
  doc.text(intro, 14, 68, { maxWidth: 182 });

  autoTable(doc, {
    startY: 86, theme: "grid",
    head: [[it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)", it ? "Servizi annuali / OPEX" : "Annual services / OPEX", it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue", it ? `TCV – valore contrattuale totale ${Math.round(Number(result.contractYears) || 0)} anni` : `TCV – total contract value ${Math.round(Number(result.contractYears) || 0)} years`]],
    body: [[money(result.capex, lang), money(result.annualOpex, lang), money(result.annualContractRevenue, lang), money(result.tcv, lang)]],
    headStyles: { fillColor: teal }, styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { halign: "right" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5, theme: "grid",
    head: [[it ? "Risparmio netto annuo" : "Annual Net Saving", it ? "Riduzione energia" : "Energy Reduction", it ? "Riduzione CO2" : "CO2 Reduction", "Payback", "NPV"]],
    body: [[money(result.annualCustomerNetBenefit, lang), `${number(result.energyReductionPct, 1, lang)}%`, `${number(result.co2ReductionTons, 1, lang)} t/yr`, result.paybackYears == null ? "-" : `${number(result.paybackYears, 1, lang)} ${it ? "anni" : "years"}`, money(result.npv, lang)]],
    headStyles: { fillColor: teal }, styles: { font: "helvetica", fontSize: 7.4, cellPadding: 2 },
    columnStyles: { 0: { halign: "right" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  let y = doc.lastAutoTable.finalY + 13;
  section(it ? "Cliente e progetto" : "Customer & Project", y);
  autoTable(doc, {
    startY: y + 5, theme: "plain",
    body: [
      [it ? "Cliente / Comune" : "Customer / Municipality", customer],
      [it ? "Progetto" : "Project", projectName],
      ["Project ID", lineage],
      ["Business Case ID", code],
      [it ? "Apparecchi esistenti" : "Existing luminaires", String(Math.round(Number(result.existingLuminaires) || 0))],
      [it ? "Apparecchi da aggiornare" : "Upgrade luminaires", String(Math.round(Number(result.upgradeLuminaires) || 0))],
      ["Smart connected", String(Math.round(Number(result.smartConnectedLuminaires) || 0))],
    ],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.3 }, columnStyles: { 0: { fontStyle: "bold", cellWidth: 58 } },
  });

  y = doc.lastAutoTable.finalY + 10;
  section(it ? "Struttura commerciale preliminare" : "Preliminary Commercial Structure", y);
  autoTable(doc, {
    startY: y + 5, theme: "grid",
    head: [[it ? "Voce" : "Item", it ? "Valore" : "Value"]],
    body: [
      [it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)", money(result.capex, lang)],
      [it ? "Servizi annuali / OPEX" : "Annual services / OPEX", money(result.annualOpex, lang)],
      [it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue", money(result.annualContractRevenue, lang)],
      [it ? "Durata contratto" : "Contract term", `${Math.round(Number(result.contractYears) || 0)} ${it ? "anni" : "years"}`],
      [it ? `TCV – valore contrattuale totale ${Math.round(Number(result.contractYears) || 0)} anni` : `TCV – total contract value ${Math.round(Number(result.contractYears) || 0)} years`, money(result.tcv, lang)],
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
    ],
    headStyles: { fillColor: teal }, styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6 }, columnStyles: { 1: { halign: "right" } },
  });

  // PAGE 2 — scope, savings, assumptions and next steps
  doc.addPage();
  section(it ? "Soluzione e ambito preliminare" : "Preliminary Solution & Scope", 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(...navy);
  doc.text(it
    ? `La configurazione preliminare prevede ${solutionDescription(project, true)}. Lo scopo definitivo sarà validato in Planner sulla base del censimento tecnico e della progettazione illuminotecnica.`
    : `The preliminary configuration includes ${solutionDescription(project, false)}. Final scope will be validated in Planner using the technical census and lighting design.`, 14, 28, { maxWidth: 182 });

  autoTable(doc, {
    startY: 39, theme: "grid",
    head: [[it ? "Ambito" : "Scope", it ? "Configurazione preliminare" : "Preliminary configuration"]],
    body: scopeRows(project, result, it),
    headStyles: { fillColor: teal },
    alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7.8, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
  });

  y = doc.lastAutoTable.finalY + 11;
  section(it ? "Impatto economico ed energetico" : "Economic & Energy Impact", y);
  autoTable(doc, {
    startY: y + 5, theme: "grid",
    head: [[it ? "Risparmio energia annuo" : "Annual Energy Saving", it ? "Risparmio netto annuo" : "Annual Net Saving", it ? "Riduzione energia" : "Energy Reduction", it ? "Riduzione CO2" : "CO2 Reduction"]],
    body: [[
      money(result.annualEnergySavingEUR, lang),
      money(result.annualCustomerNetBenefit, lang),
      `${number(result.energyReductionPct, 1, lang)}%`,
      `${number(result.co2ReductionTons, 1, lang)} t/${it ? "anno" : "yr"}`,
    ]],
    headStyles: { fillColor: teal },
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 2 },
    columnStyles: { 0: { halign: "right" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  y = doc.lastAutoTable.finalY + 11;
  section(it ? "Ipotesi principali" : "Key Assumptions", y);
  autoTable(doc, {
    startY: y + 5, theme: "grid",
    head: [[it ? "Parametro" : "Parameter", it ? "Valore" : "Value"]],
    body: [
      [it ? "Prezzo energia" : "Energy price", `${number(project.assumptions?.energyPrice, 2, lang)} €/kWh`],
      [it ? "Ore di funzionamento annue" : "Annual operating hours", number(project.assumptions?.operatingHours, 0, lang)],
      [it ? "Periodo di analisi" : "Analysis period", `${Math.round(Number(project.assumptions?.analysisPeriod) || 0)} ${it ? "anni" : "years"}`],
      [it ? "Periodo servizi" : "Service agreement period", `${Math.round(Number(project.assumptions?.serviceAgreementPeriod) || Number(result.contractYears) || 0)} ${it ? "anni" : "years"}`],
      [it ? "Modello commerciale" : "Commercial model", String(project.assumptions?.dealType || project.assumptions?.financingModel || "cash")],
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
    ],
    headStyles: { fillColor: teal }, alternateRowStyles: { fillColor: light },
    styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.35 }, columnStyles: { 1: { halign: "right" } },
  });

  y = doc.lastAutoTable.finalY + 10;
  section(it ? "Passaggio a VIMALUX Planner" : "Transition to VIMALUX Planner", y);
  const steps = it ? [
    ["1", "Censimento tecnico e geolocalizzazione"],
    ["2", "Classificazione stradale e verifica UNI 11248"],
    ["3", "Dimensionamento, ottiche e assegnazione prodotti"],
    ["4", "BOM, installazione, logistica e struttura commerciale definitiva"],
    ["5", "Proposta ufficiale Planner con lo stesso Project ID"],
  ] : [
    ["1", "Technical census and geolocation"],
    ["2", "Road classification and UNI 11248 verification"],
    ["3", "Sizing, optics and final product assignment"],
    ["4", "BOM, installation, logistics and final commercial structure"],
    ["5", "Official Planner proposal using the same Project ID"],
  ];
  autoTable(doc, {
    startY: y + 5, theme: "plain", body: steps,
    styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.05, textColor: navy },
    columnStyles: { 0: { cellWidth: 8, fontStyle: "bold", textColor: teal, halign: "center" } },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(...pale); doc.setDrawColor(167, 243, 208); doc.roundedRect(14, y, 182, 17, 2, 2, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.8); doc.setTextColor(...teal);
  doc.text(it ? "Continuità del progetto" : "Project continuity", 18, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.3); doc.setTextColor(...navy);
  doc.text(it
    ? `Project ID ${lineage} resterà invariato in Intelligence, Planner e CRM, preservando Business Case, versioni di proposta e cronologia.`
    : `Project ID ${lineage} remains unchanged across Intelligence, Planner and CRM, preserving the Business Case, proposal versions and history.`, 18, y + 10, { maxWidth: 174 });

  y += 25;
  section(it ? "Condizioni e limitazioni" : "Terms & Limitations", y);
  doc.setFontSize(7.3); doc.setTextColor(...muted); doc.setFont("helvetica", "normal");
  const disclaimer = it
    ? "Questa proposta è indicativa e non costituisce un'offerta finale vincolante. È basata sui dati disponibili, quantità aggregate, potenze e ipotesi economiche del Business Case alla data di emissione. Prezzi, quantità, installazione, logistica, imposte, finanziamento e prestazioni definitive saranno confermati nella proposta ufficiale generata da VIMALUX Planner. IVA esclusa salvo diversa indicazione."
    : "This proposal is indicative and does not constitute a final binding quotation. It is based on available data, aggregated quantities, wattages and commercial assumptions in the Business Case at the issue date. Final prices, quantities, installation, logistics, taxes, financing and performance will be confirmed in the official proposal generated by VIMALUX Planner. VAT excluded unless otherwise stated.";
  doc.text(disclaimer, 14, y + 7, { maxWidth: 182 });

  drawFooter(doc, doc.getNumberOfPages(), proposalId, version, lineage, it, muted);
  const filename = proposalFilename(code, version);
  doc.save(filename);
  return filename;
}

function showToast(message, error = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `position:fixed;right:22px;bottom:22px;z-index:10000;padding:12px 16px;border-radius:8px;color:#fff;font:600 13px/1.3 system-ui;background:${error ? "#b42318" : "#087f5b"};box-shadow:0 10px 30px rgba(15,23,42,.2)`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

async function createAndPublish(button) {
  if (button.disabled) return;
  button.disabled = true;
  const original = button.textContent;
  try {
    const { row, version } = await loadContext();
    button.textContent = row.intelligence_data?.language === "it" ? "Generazione…" : "Generating…";
    const filename = generatePdf(row, version);
    const { error } = await supabase.rpc("publish_intelligence_preliminary_proposal", {
      case_id: row.id,
      quotation_id: `PRE-${row.business_case_code}`,
      proposal_status: "draft",
      pdf_reference: filename,
      savings_report_reference: null,
    });
    if (error) throw error;
    showToast(row.intelligence_data?.language === "it"
      ? `Proposta preliminare v${version} salvata nel CRM`
      : `Preliminary Proposal v${version} saved to CRM`);
  } catch (error) {
    console.error("Preliminary Proposal publish failed", error);
    showToast(error?.message || "Proposal could not be published", true);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function ensureButton() {
  const actions = document.querySelector(".report-actions");
  if (!actions || actions.querySelector("#generatePreliminaryProposalBtn")) return;
  const existing = actions.querySelector("button.primary");
  const button = document.createElement("button");
  button.id = "generatePreliminaryProposalBtn";
  button.type = "button";
  button.className = "primary";
  const isItalian = document.documentElement.lang === "it" || document.querySelector(".report-head h2")?.textContent?.includes("Preliminare");
  button.textContent = isItalian ? "Genera Proposta Preliminare" : "Generate Preliminary Proposal";
  button.style.marginLeft = "8px";
  button.addEventListener("click", () => createAndPublish(button));
  existing?.classList.remove("primary");
  actions.appendChild(button);
}

const observer = new MutationObserver(ensureButton);
observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
window.addEventListener("load", ensureButton, { once: true });
setTimeout(ensureButton, 500);