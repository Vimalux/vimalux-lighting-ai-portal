import { proposalSolutionScope } from "./proposalSolutionScope.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "./supabase.js";
import { applyWarrantyPricing, warrantyLabel } from "./warranty.js";
import { calculateBusinessCase } from "./calculations.js";
import { qualityGateMessage, validateProposalQuality } from "./proposalQuality.js";
import { transformProposalCustomerText } from "./proposalCustomerVatText.js";
import { proposalProjectWithCatalogue } from "./proposalContext.js";
import { getActiveBusinessCaseResult, getLiveBusinessCaseResult } from "./liveBusinessCaseResult.js";
import { preliminaryProposalNarrative, preliminaryProposalT, preliminaryButtonCopy } from "./preliminaryProposalCopy.js";
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
  const { data: catalogue, error: catalogueError } = await supabase.rpc("get_intelligence_catalogue");
  if (catalogueError) throw catalogueError;
  // The React screen can be newer than Supabase during the autosave window.
  // Prefer the active, already-calculated Business Case and hydrate it with the
  // canonical catalogue so both report buttons use exactly what the user sees.
  const live = getActiveBusinessCaseResult(window.location.search)
    || getLiveBusinessCaseResult(window.location.search);
  const sourceRow = live?.project ? { ...row, intelligence_data: live.project } : row;
  const hydratedProject = proposalProjectWithCatalogue(sourceRow, catalogue);
  const hydratedRow = {
    ...row,
    intelligence_data: hydratedProject,
    result_summary: live?.result || row.result_summary,
  };
  const { data: history, error: historyError } = await supabase.rpc("get_proposal_history", { opportunity_id: row.crm_opportunity_id });
  if (historyError) throw historyError;
  const previous = (history || []).filter((item) => item.proposal_type === "preliminary" && item.source === "intelligence");
  const version = previous.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  return { row: hydratedRow, version };
}

function filename(code, version) {
  return `VIMALUX_PRE_${String(code || "BUSINESS_CASE").replace(/[^A-Z0-9_-]/gi, "_")}_v${version}.pdf`;
}

function solutionDescription(project, it, hybridUnits = 0, lang = "en") {
  const solution = project?.solution || {};
  const parts = [it ? "upgrade a LED ad alta efficienza" : "high-efficiency LED upgrade"];
  if (hybridUnits > 0) parts.push(it ? `integrazione Hybrid Solar su ${Math.round(hybridUnits)} apparecchi` : `Hybrid Solar integration on ${Math.round(hybridUnits)} luminaires`);
  if (solution.smartEnabled) parts.push(it ? "controllo Smart Lighting connesso" : "connected Smart Lighting control");
  if (solution.cmsEnabled) parts.push(it ? "monitoraggio CMS, allarmi e gestione remota" : "CMS monitoring, alarms and remote management");
  if (solution.powerAidEnabled) parts.push(it ? "ottimizzazione adattiva Adaptive Dimming" : "Adaptive Dimming adaptive optimization");
  return parts.map((part) => preliminaryProposalT(lang, part)).join(", ");
}

function maintenanceSaving(project) {
  const upgraded = (project?.groups || []).reduce((sum, group) => group?.upgradeSelected === false ? sum : sum + Math.max(0, Number(group?.quantity) || 0), 0);
  const existing = Math.max(0, Number(project?.assumptions?.existingMaintenance) || 0);
  const next = Math.max(0, Number(project?.assumptions?.newMaintenance) || 0);
  return upgraded * Math.max(0, existing - next);
}

export function generatePdf(row, version) {
  const project = row.intelligence_data || {};
  const result = row.result_summary || {};
  const calculated = calculateBusinessCase(applyWarrantyPricing(project));
  const hybrid = calculated?.hybridSolar || {};
  const hybridUnits = hybrid.enabled ? Math.max(0, Number(hybrid.totalHybridUnits) || 0) : 0;
  const hybridInstalledPvKwp = hybrid.enabled
    ? (Array.isArray(hybrid.rows) ? hybrid.rows : []).reduce((sum, item) => sum + Math.max(0, Number(item?.quantity) || 0) * Math.max(0, Number(item?.pvWp) || 0) / 1000, 0)
    : 0;
  const hybridGridOffsetKwh = hybrid.enabled ? Math.max(0, Number(calculated.hybridSolarSavingKwh) || 0) : 0;
  const hybridBenefitEur = hybrid.enabled ? Math.max(0, Number(calculated.hybridSolarSavingEUR) || 0) : 0;
  const lang = ["it", "en", "es", "da"].includes(project.language) ? project.language : "en";
  const it = lang === "it";
  const yearUnit = { it: "anni", en: "years", es: "años", da: "år" }[lang];
  const annualUnit = { it: "anno", en: "yr", es: "año", da: "år" }[lang];
  const luminaireUnit = { it: "apparecchi", en: "luminaires", es: "luminarias", da: "armaturer" }[lang];
  const customerText = (value) => transformProposalCustomerText(value, project, lang);
  const lineage = pdfSafeText(row.project_lineage_id || project.crm?.projectLineageId || "-");
  const code = pdfSafeText(row.business_case_code || project.project?.businessCaseId || "-");
  const customer = pdfSafeText(project.customer?.name || row.crm_fields?.customer || "-");
  const projectName = pdfSafeText(project.project?.name || row.crm_fields?.project || customer);
  const proposalId = `PRE-${code}`;
  const date = new Date().toLocaleDateString({ it: "it-IT", en: "en-GB", es: "es-ES", da: "da-DK" }[lang]);
  const contractYears = Math.round(Number(calculated.serviceAgreementPeriod) || Number(result.contractYears) || Number(project.assumptions?.serviceAgreementPeriod) || 0);
  const analysisYears = Math.round(Number(calculated.analysisPeriod) || contractYears);
  const powerAidYears = project.solution?.powerAidEnabled ? Math.max(1, Math.min(contractYears, Math.round(Number(project.assumptions?.powerAidServicePeriod) || 10))) : 0;
  const energyEscalation = Number(project.assumptions?.energyEscalation) || 0;
  const scope = proposalSolutionScope(calculated, result, lang);
  const annualFee = Number(calculated.customerAnnualPayment ?? result.annualCustomerPayment ?? result.annualOpex) || 0;
  const maintSaving = Number(calculated.maintenanceSaving) || maintenanceSaving(project);
  const energySaving = Number(calculated.energySaving ?? result.annualEnergySavingEUR) || 0;
  const netBenefit = Number(calculated.customerCashAnnualNetBenefit ?? result.annualCustomerNetBenefit) || (energySaving + maintSaving - annualFee);
  const capexBreakdown = buildCustomerCapexRows(project, Number(calculated.totalCapex ?? result.capex) || 0, lang, calculated.additionalCapexSales ?? result.additionalCapexSales);
  const dealType = String(calculated.dealType || project.assumptions?.dealType || "cash").toLowerCase();
  const displayDealType = ({
    it: { cash: "Acquisto diretto", finance: "Finanziamento", noleggio_operativo: "Noleggio operativo / LaaS" },
    en: { cash: "Direct purchase", finance: "Financing", noleggio_operativo: "Operating lease / LaaS" },
    es: { cash: "Compra directa", finance: "Financiación", noleggio_operativo: "Arrendamiento operativo / LaaS" },
    da: { cash: "Direkte køb", finance: "Finansiering", noleggio_operativo: "Operationel leasing / LaaS" },
  }[lang] || {})[dealType] || dealType;
  const isLaaS = dealType === "noleggio_operativo";
  const isFinance = dealType === "finance";
  const isFinanced = isLaaS || isFinance;
  const upfrontCustomerInvestment = isFinanced ? Math.max(0, Number(project.assumptions?.upfrontPayment) || 0) : Math.max(0, Number(calculated.totalCapex ?? result.capex) || 0);
  const projectCapexLabel = isFinanced
    ? (it ? "CAPEX progetto / investimento finanziato" : "Project CAPEX / financed investment")
    : (it ? "Investimento iniziale" : "Initial investment");
  const annualPaymentLabel = isLaaS
    ? (it ? "Canone annuale LaaS / Noleggio tutto incluso - netto IVA" : "Annual all-inclusive LaaS / lease payment - excl. VAT")
    : isFinance
      ? (it ? "Pagamento annuale totale cliente" : "Total annual customer payment")
      : (it ? "OPEX annuale Smart / CMS" : "Annual Smart / CMS OPEX");
  const monthlyCustomerPayment = Math.max(0, Number(calculated.monthlyPayment) || annualFee / 12);
  const grossMonthlyCustomerPayment = Math.max(monthlyCustomerPayment, Number(calculated.customerGrossMonthlyPayment) || monthlyCustomerPayment);
  const grossAnnualCustomerPayment = Math.max(annualFee, Number(calculated.customerGrossAnnualPayment) || annualFee);
  const netContractValue = Math.max(0, Number(calculated.totalContractRevenue ?? result.tcv) || 0);
  const grossContractValue = Math.max(netContractValue, Number(calculated.customerGrossContractValue) || netContractValue);
  const summaryAnnualPaymentLabel = isLaaS
    ? (it ? "Canone annuale LaaS / Noleggio - lordo IVA" : "Annual LaaS / lease payment - incl. VAT")
    : isFinance
      ? (it ? "Pagamento annuale cliente - lordo IVA" : "Annual customer payment - incl. VAT")
      : annualPaymentLabel;
  const summaryTcvLabel = isFinanced
    ? (it ? `TCV cash-out cliente ${contractYears} anni` : `Customer cash-out TCV ${contractYears} years`)
    : (it ? `TCV ${contractYears} anni` : `TCV ${contractYears} years`);
  const monthlyFinancingPayment = Math.max(0, Number(calculated.financingMonthlyPayment) || 0);
  const monthlyServiceOpex = Math.max(0, Number(calculated.totalAnnualOpex) || 0) / 12;

  const Pdf = typeof jsPDF === "function" ? jsPDF : jsPDF.jsPDF;
  const tableRenderer = typeof autoTable === "function" ? autoTable : autoTable.default;
  const doc = new Pdf({ unit: "mm", format: "a4" });
  const teal = [15, 118, 110];
  const navy = [15, 23, 42];
  const muted = [71, 85, 105];
  const light = [248, 250, 252];
  const local = (value) => preliminaryProposalT(lang, value);
  const write = (value, x, y, options) => doc.text(pdfSafeText(local(value)), x, y, options);
  const proposalTable = (pdf, options) => {
    const localRows = (rows) => rows?.map((row) => row.map((cell) => typeof cell === "string" ? local(cell) : cell));
    return tableRenderer(pdf, { ...options, head: localRows(options.head), body: localRows(options.body) });
  };
  const section = (title, y) => {
    doc.setTextColor(...teal); doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); write(title, 14, y); doc.setTextColor(...navy);
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
  doc.setFontSize(15); write(it ? "Proposta Preliminare Smart Lighting" : "Preliminary Smart Lighting Proposal", 14, 29);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); write(`${proposalId} | v${version}  |  ${local("Project ID")} ${lineage}  |  ${date}`, 14, 39);

  section(it ? "Sintesi della proposta" : "Proposal Summary", 60);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...navy);
  const intro = ["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "intro", {
    projectName, code, solution: solutionDescription(project, false, hybridUnits, lang),
  }) : it
    ? `VIMALUX presenta una proposta preliminare per ${projectName}, basata sul Business Case ${code}. La soluzione comprende ${solutionDescription(project, true, hybridUnits)}. I valori economici sono preliminari; dimensionamento, ottiche e assegnazione definitiva dei prodotti saranno validati in VIMALUX Planner.`
    : `VIMALUX presents a preliminary proposal for ${projectName}, based on Business Case ${code}. The solution includes ${solutionDescription(project, false, hybridUnits)}. Commercial values are preliminary; sizing, optics and final product assignment will be validated in VIMALUX Planner.`;
  write(intro, 14, 68, { maxWidth: 182 });
  const introLines = doc.splitTextToSize(pdfSafeText(intro), 182).length;

  proposalTable(doc, {
    startY: Math.max(86, 68 + introLines * 3.7 + 5), theme: "grid",
    head: [[projectCapexLabel, summaryAnnualPaymentLabel, summaryTcvLabel]],
    body: [[money(calculated.totalCapex ?? result.capex, lang), money(isFinanced ? grossAnnualCustomerPayment : annualFee, lang), money(isFinanced ? grossContractValue : netContractValue, lang)]],
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
    ...alignedTable({ 0: "right", 1: "right", 2: "right" }),
  });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.1); doc.setTextColor(...muted);
  write(lang === "es" && isFinanced
    ? "TCV de pagos del cliente = cuotas contractuales con el IVA no recuperable durante el período."
    : lang === "da" && isFinanced
      ? "Kundens kontantbetaling over kontrakten = aftalte ydelser inklusive ikke-fradragsberettiget moms."
      : it
    ? (isFinanced
      ? "TCV cash-out cliente = pagamenti contrattuali comprensivi dell'IVA non recuperabile nel periodo."
      : "TCV = somma dei pagamenti contrattuali previsti nel periodo.")
    : (isLaaS
      ? "TCV = sum of the contractual LaaS / lease payments over the term."
      : "TCV = sum of contractual customer payments over the term."), 14, doc.lastAutoTable.finalY + 4.5);

  proposalTable(doc, {
    startY: doc.lastAutoTable.finalY + 8, theme: "grid",
    head: [[customerText(it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit"), it ? "Riduzione energia" : "Energy reduction", it ? "Riduzione CO2" : "CO2 reduction", isFinanced ? (it ? "Payback operativo (escl. finanziamento)" : "Operational payback (excl. financing)") : "Payback", customerText(it ? `VAN beneficio Comune (${analysisYears} anni)` : `Municipality-benefit NPV (${analysisYears} years)`) ]],
    body: [[money(netBenefit, lang), `${number(calculated.energyReductionPercent ?? result.energyReductionPct, 1, lang)}%`, `${number((Number(calculated.co2ReductionKg) || 0) / 1000 || result.co2ReductionTons, 1, lang)} t/${annualUnit}`, calculated.payback == null ? "-" : `${number(calculated.payback, 1, lang)} ${yearUnit}`, money(calculated.customerCashNpv ?? result.npv, lang)]],
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 7.1, cellPadding: 2 },
    ...alignedTable({ 0: "right", 1: "right", 2: "right", 3: "right", 4: "right" }),
  });

  let y = doc.lastAutoTable.finalY + 12;
  section(it ? "Cliente e progetto" : "Customer & Project", y);
  proposalTable(doc, {
    startY: y + 5, theme: "plain",
    body: [
      [customerText(it ? "Cliente / Comune" : "Customer / Municipality"), customer],
      [it ? "Progetto" : "Project", projectName], ["Project ID", lineage], ["Business Case ID", code],
      [it ? "Apparecchi esistenti" : "Existing luminaires", String(Math.round(Number(calculated.totalQuantity ?? result.existingLuminaires) || 0))],
      [it ? "Apparecchi da aggiornare" : "Upgrade luminaires", String(Math.round(Number(calculated.upgradedQuantity ?? result.upgradeLuminaires) || 0))],
      ["Smart connected", String(Math.round(Number(calculated.lcuQuantity ?? result.smartConnectedLuminaires) || 0))],
      ...(hybridUnits > 0 ? [["Hybrid Solar", `${number(hybridUnits, 0, lang)} ${luminaireUnit} · ${number(hybridInstalledPvKwp, 2, lang)} kWp · ${number(hybridGridOffsetKwh, 0, lang)} kWh/${annualUnit} ${it ? "offset rete" : lang === "es" ? "ahorro de red" : lang === "da" ? "netreduktion" : "grid offset"}`]] : []),
    ],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 58, halign: "left" }, 1: { halign: "left" } },
  });

  const commercialRows = [
      [projectCapexLabel, money(calculated.totalCapex ?? result.capex, lang)],
      ...(isFinanced ? [[it ? "Investimento iniziale cliente" : "Customer upfront investment", money(upfrontCustomerInvestment, lang)]] : []),
      [annualPaymentLabel, money(annualFee, lang)],
      ...(isFinanced ? [[it ? "Pagamento annuale totale cliente - lordo IVA" : "Total annual customer payment - incl. VAT", money(grossAnnualCustomerPayment, lang)]] : []),
      ...(isLaaS ? [
        [it ? "Canone mensile LaaS / Noleggio tutto incluso - netto IVA" : "Monthly all-inclusive LaaS / lease payment - excl. VAT", money(monthlyCustomerPayment, lang)],
        [it ? "Canone mensile lordo cliente" : "Gross monthly customer payment", money(grossMonthlyCustomerPayment, lang)],
        [it ? "OPEX servizi / mese (incluso nel canone)" : "Service OPEX / month (included in payment)", money(monthlyServiceOpex, lang)],
      ] : isFinance ? [
        [it ? "Rata mensile finanziamento CAPEX" : "Monthly CAPEX financing payment", money(monthlyFinancingPayment, lang)],
        [it ? "OPEX servizi / mese" : "Service OPEX / month", money(monthlyServiceOpex, lang)],
        [it ? "Pagamento mensile totale cliente" : "Total monthly customer payment", money(monthlyCustomerPayment, lang)],
        [it ? "Pagamento mensile lordo cliente" : "Gross monthly customer payment", money(grossMonthlyCustomerPayment, lang)],
      ] : []),
      [it ? "Durata CMS" : "CMS service term", `${contractYears} ${yearUnit}`],
      ...(project.solution?.powerAidEnabled ? [[it ? "Durata Adaptive Dimming" : "Adaptive Dimming service term", `${powerAidYears} ${yearUnit}`]] : []),
      ...(hybridBenefitEur > 0 ? [[it ? "Beneficio Hybrid Solar annuo (incluso nel risparmio energia)" : "Annual Hybrid Solar benefit (included in energy saving)", money(hybridBenefitEur, lang)]] : []),
      [it ? `TCV netto IVA ${contractYears} anni` : `TCV excl. VAT ${contractYears} years`, money(netContractValue, lang)],
      ...(isFinanced ? [[it ? `TCV cash-out cliente ${contractYears} anni` : `Customer cash-out TCV ${contractYears} years`, money(grossContractValue, lang)]] : []),
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
  ];
  y = doc.lastAutoTable.finalY + 9;
  // A partially spilled table previously left just the warranty row on an otherwise blank page.
  // Keep the heading and complete commercial table together, even for longer translations.
  if (needsNewPdfPage(y, 8 + commercialRows.length * 4.8, 285, 4)) {
    doc.addPage();
    y = 20;
  }
  section(it ? "Struttura commerciale preliminare" : "Preliminary Commercial Structure", y);
  proposalTable(doc, {
    startY: y + 5, theme: "grid", head: [[it ? "Voce" : "Item", it ? "Valore" : "Value"]],
    body: commercialRows,
    pageBreak: "avoid", rowPageBreak: "avoid",
    headStyles: tableHead, styles: { font: "helvetica", fontSize: 8, cellPadding: 1.0 },
    ...alignedTable({ 0: "left", 1: "right" }),
  });

  doc.addPage();
  section(it ? "Soluzione e ambito preliminare" : "Preliminary Solution & Scope", 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(...navy);
  write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "scope", {
    solution: solutionDescription(project, false, hybridUnits, lang),
  }) : it
    ? `La configurazione preliminare prevede ${solutionDescription(project, true, hybridUnits)}. La progettazione illuminotecnica definitiva resta soggetta a validazione in Planner.`
    : `The preliminary configuration includes ${solutionDescription(project, false, hybridUnits)}. Final lighting design remains subject to validation in Planner.`, 14, 28, { maxWidth: 182 });

  proposalTable(doc, {
    startY: 39, theme: "grid", head: [[it ? "Ambito" : "Scope", it ? "Configurazione preliminare" : "Preliminary configuration"]],
    body: [
      [it ? "Upgrade LED" : "LED upgrade", scope.led],
      ...(hybridUnits > 0 ? [["Hybrid Solar", `${number(hybridUnits, 0, lang)} ${luminaireUnit} · ${number(hybridInstalledPvKwp, 2, lang)} kWp · ${number(hybridGridOffsetKwh, 0, lang)} kWh/${annualUnit} ${it ? "offset rete" : lang === "es" ? "ahorro de red" : lang === "da" ? "netreduktion" : "grid offset"}`]] : []),
      [it ? "Controllo connesso" : "Connected control", scope.connected],
      ["CMS", project.solution?.cmsEnabled ? (it ? "Monitoraggio, allarmi e gestione remota" : "Monitoring, alarms and remote management") : (it ? "Non incluso" : "Not included")],
      ["Adaptive Dimming", scope.adaptive],
      ...scope.existingDimmingRows,
    ],
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 7.6, cellPadding: 1.25 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48, halign: "left" }, 1: { halign: "left" } },
  });

  y = doc.lastAutoTable.finalY + 6;
  section(it ? "Come si genera il beneficio annuo" : "Annual benefit bridge", y);
  const annualBenefitRows = [
    [it ? "Risparmio energia" : "Energy saving", money(energySaving, lang)],
    ...(hybridBenefitEur > 0 ? [[it ? "di cui Hybrid Solar (già incluso)" : "of which Hybrid Solar (already included)", money(hybridBenefitEur, lang)]] : []),
    [it ? "Risparmio manutenzione" : "Maintenance saving", money(maintSaving, lang)],
    [annualPaymentLabel, isFinanced ? money(annualFee, lang) : `(${money(annualFee, lang)})`],
    ...(isFinanced ? [[
      isLaaS
        ? (it ? "Canone annuale LaaS / Noleggio tutto incluso - lordo IVA" : "Annual all-inclusive LaaS / lease payment - incl. VAT")
        : (it ? "Pagamento annuale totale cliente - lordo IVA" : "Total annual customer payment - incl. VAT"),
      `(${money(grossAnnualCustomerPayment, lang)})`,
    ]] : []),
    [customerText(it ? "Beneficio netto annuo Comune" : "Municipality annual net benefit"), money(netBenefit, lang)],
  ];
  proposalTable(doc, {
    startY: y + 4, theme: "grid", head: [[it ? "Componente" : "Component", it ? "Valore annuo" : "Annual value"]],
    body: annualBenefitRows,
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.25 },
    ...alignedTable({ 0: "left", 1: "right" }),
    didParseCell: mergeTableHooks(
      alignedTable({ 0: "left", 1: "right" }).didParseCell,
      (data) => { if (data.section === "body" && data.row.index === annualBenefitRows.length - 1) data.cell.styles.fontStyle = "bold"; },
    ),
  });

  if (isFinanced) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.7); doc.setTextColor(...muted);
    write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "net", {
      energySaving: money(energySaving, lang), maintenanceSaving: money(maintSaving, lang),
      grossPayment: money(grossAnnualCustomerPayment, lang), netBenefit: money(netBenefit, lang),
    }) : it
      ? `Calcolo beneficio netto: ${money(energySaving, lang)} + ${money(maintSaving, lang)} - ${money(grossAnnualCustomerPayment, lang)} = ${money(netBenefit, lang)}.`
      : `Net-benefit calculation: ${money(energySaving, lang)} + ${money(maintSaving, lang)} - ${money(grossAnnualCustomerPayment, lang)} = ${money(netBenefit, lang)}.`,
    14, doc.lastAutoTable.finalY + 4, { maxWidth: 182 });
  }

  y = doc.lastAutoTable.finalY + (isFinanced ? 9 : 6);
  y = beginSection(it ? "Composizione dell'investimento" : "Investment composition", y, 22);
  proposalTable(doc, {
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
  y = beginSection(it ? "Ipotesi principali" : "Key Assumptions", y, 52);
  proposalTable(doc, {
    startY: y + 4, theme: "grid", head: [[it ? "Parametro" : "Parameter", it ? "Valore" : "Value"]],
    body: [
      [it ? "Prezzo energia" : "Energy price", `${number(project.assumptions?.energyPrice, 2, lang)} €/kWh`],
      [it ? "Indicizzazione prezzo energia" : "Energy price escalation", `${number(energyEscalation, 1, lang)}% ${it ? "annuo" : lang === "es" ? "anual" : lang === "da" ? "årligt" : "p.a."}`],
      [it ? "Ore di funzionamento annue" : "Annual operating hours", number(project.assumptions?.operatingHours, 0, lang)],
      [it ? "Periodo di analisi" : "Analysis period", `${analysisYears} ${yearUnit}`],
      [it ? "Durata CMS" : "CMS service term", `${contractYears} ${yearUnit}`],
      ...(project.solution?.powerAidEnabled ? [[it ? "Durata Adaptive Dimming" : "Adaptive Dimming service term", `${powerAidYears} ${yearUnit}`]] : []),
      [it ? "Indicizzazione pagamento cliente" : "Customer payment indexation", it ? "Nessuna: rate e canoni fissi per i rispettivi periodi contrattuali" : "None: instalments and service fees fixed for their respective contractual terms"],
      [it ? "Modello commerciale" : "Commercial model", displayDealType],
      [it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],
    ],
    headStyles: tableHead, alternateRowStyles: { fillColor: light }, styles: { font: "helvetica", fontSize: 6.8, cellPadding: 0.8 },
    ...alignedTable({ 0: "left", 1: "right" }),
    margin: { left: 14, right: 14, bottom: 18 },
  });

  y = doc.lastAutoTable.finalY + 4;
  y = beginSection(it ? "Passaggio a VIMALUX Planner" : "Transition to VIMALUX Planner", y, 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(...navy);
  write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "planner") : it
    ? "Dopo l'aggiudicazione, o con incarico separato: censimento e geolocalizzazione - classificazione UNI 11248 - dimensionamento e ottiche - BOM/logistica - proposta ufficiale Planner."
    : "After contract award, or under a separate assignment: census and geolocation - UNI 11248 classification - sizing and optics - BOM/logistics - official Planner proposal.", 14, y + 5, { maxWidth: 182 });
  doc.setFontSize(6.5); doc.setTextColor(...muted);
  write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "plannerCost") : it
    ? "Il relativo costo non è incluso nel CAPEX, salvo una voce specifica nel Business Case o nell'offerta definitiva."
    : "The related cost is not included in CAPEX unless a specific line is included in the Business Case or final offer.", 14, y + 12, { maxWidth: 182 });
  write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "lineage", { lineage }) : it
    ? `Project ID ${lineage} resterà invariato in Intelligence, Planner e CRM, preservando Business Case, versioni e cronologia.`
    : `Project ID ${lineage} remains unchanged across Intelligence, Planner and CRM, preserving the Business Case, versions and history.`, 14, y + 18, { maxWidth: 182 });

  y += 27;
  y = beginSection(it ? "Condizioni e limitazioni" : "Terms & Limitations", y, 26);
  doc.setFontSize(6.5); doc.setTextColor(...muted); doc.setFont("helvetica", "normal");
  write(["es", "da"].includes(lang) ? preliminaryProposalNarrative(lang, "disclaimer", { project }) : customerText(it
    ? "Questa proposta è indicativa, condivisibile con il cliente e non costituisce un'offerta finale vincolante. Un'offerta definitiva richiede autorizzazione commerciale VIMALUX. È basata sui dati disponibili e sulle voci economiche inserite nel Business Case alla data di emissione. Prezzi, quantità, installazione, logistica, imposte, finanziamento e prestazioni definitive saranno confermati nella proposta ufficiale generata da VIMALUX Planner. IVA esclusa salvo diversa indicazione."
    : "This preliminary proposal may be shared with the client but is not a final binding quotation. A final offer requires VIMALUX commercial authorization. It is based on available data and the economic items entered in the Business Case at the issue date. Final prices, quantities, installation, logistics, taxes, financing and performance will be confirmed in the official proposal generated by VIMALUX Planner. VAT excluded unless otherwise stated."), 14, y + 5, { maxWidth: 182 });

  const pdfName = filename(code, version);
  doc.__vimaluxProposalProject = project;
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
    const lang = preliminaryButtonCopy[project.language] ? project.language : "en";
    const buttonCopy = preliminaryButtonCopy[lang];
    const validation = validateProposalQuality(project);
    if (!validation.ok) throw new Error(qualityGateMessage(validation, lang));
    button.textContent = buttonCopy.busy;
    const pdfName = generatePdf(row, version);
    const { error } = await supabase.rpc("publish_intelligence_preliminary_proposal", {
      case_id: row.id, quotation_id: `PRE-${row.business_case_code}`, proposal_status: "draft", pdf_reference: pdfName, savings_report_reference: null,
    });
    if (error) throw error;
    showToast(buttonCopy.saved(version));
  } catch (error) {
    console.error("Preliminary Proposal publish failed", error);
    const lang = currentProposalLanguage();
    showToast(error?.message || preliminaryButtonCopy[lang].failure, true);
  } finally {
    button.disabled = false; button.textContent = original;
  }
}

function currentProposalLanguage() {
  const active = getActiveBusinessCaseResult(window.location.search) || getLiveBusinessCaseResult(window.location.search);
  const language = active?.project?.language || document.documentElement.lang;
  return preliminaryButtonCopy[language] ? language : "en";
}

function ensureButton() {
  const actions = document.querySelector(".report-actions");
  if (!actions) return;
  const existingProposalButton = actions.querySelector("#generatePreliminaryProposalBtn");
  if (existingProposalButton) {
    const label = preliminaryButtonCopy[currentProposalLanguage()].create;
    if (!existingProposalButton.disabled && existingProposalButton.textContent !== label) existingProposalButton.textContent = label;
    return;
  }
  const existing = actions.querySelector("button.primary");
  const button = document.createElement("button");
  button.id = "generatePreliminaryProposalBtn"; button.type = "button"; button.className = "primary";
  button.textContent = preliminaryButtonCopy[currentProposalLanguage()].create;
  button.style.marginLeft = "8px"; button.addEventListener("click", () => createAndPublish(button));
  existing?.classList.remove("primary"); actions.appendChild(button);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const observer = new MutationObserver(ensureButton);
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });
  window.addEventListener("load", ensureButton, { once: true });
  setTimeout(ensureButton, 500);
}
