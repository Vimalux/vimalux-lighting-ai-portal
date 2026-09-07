import { jsPDF } from "jspdf";
import {
  customerReportPartyLabel,
  customerVatDisclosure,
  customerVatSubject,
  normalizeCustomerVatType,
} from "./customerVatProfile.js";

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

function annualBenefitLabel(project, language) {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  if (language === "it") {
    if (type === "municipality") return "Beneficio netto annuo Comune";
    if (type === "esco_company") return "Beneficio netto annuo cliente / ESCO";
    return "Beneficio netto annuo cliente";
  }
  if (type === "municipality") return "Municipality annual net benefit";
  if (type === "esco_company") return "Customer / ESCO annual net benefit";
  return "Customer annual net benefit";
}

function npvLabel(project, language, suffix = "") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  if (language === "it") {
    const subject = type === "municipality" ? "Comune" : type === "esco_company" ? "cliente / ESCO" : "cliente";
    return `VAN beneficio ${subject}${suffix}`;
  }
  if (type === "municipality") return `Municipality-benefit NPV${suffix}`;
  if (type === "esco_company") return `Customer / ESCO-benefit NPV${suffix}`;
  return `Customer-benefit NPV${suffix}`;
}

export function transformProposalCustomerText(value, project = {}, language = "it") {
  if (Array.isArray(value)) return value.map((item) => transformProposalCustomerText(item, project, language));
  if (typeof value !== "string" || !value) return value;

  const it = language === "it";
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const subject = customerVatSubject(project, language);
  const partyLabel = customerReportPartyLabel(project, language);
  let text = value;

  if (it) {
    text = text.replaceAll("Beneficio netto annuo Comune", annualBenefitLabel(project, language));
    text = text.replace(/VAN beneficio Comune(\s*\([^)]*\))?/g, (_match, suffix = "") => npvLabel(project, language, suffix));
    text = text.replaceAll("Cliente / Comune", partyLabel);
    if (type !== "municipality") {
      text = text.replaceAll("Payback Comune", `Payback ${subject}`);
      text = text.replaceAll("VAN Comune", `VAN ${subject}`);
      text = text.replaceAll("Impatto IVA per il Comune", `Impatto IVA per il ${subject}`);
      text = text.replaceAll("CAPEX lordo Comune", `CAPEX lordo ${subject}`);
      text = text.replaceAll("Cash-out CAPEX Comune", `Cash-out CAPEX ${subject}`);
      text = text.replaceAll("Cash-out annuo Comune", `Cash-out annuo ${subject}`);
      text = text.replaceAll("il CAPEX iniziale è sostenuto dal Comune", `il CAPEX iniziale è sostenuto dal ${subject}`);
      text = text.replaceAll("cash flow cumulativo del Comune", `cash flow cumulativo del ${subject}`);
    }
    if (text.includes("IVA esclusa salvo diversa indicazione.")) {
      text = text.replace("IVA esclusa salvo diversa indicazione.", customerVatDisclosure(project, language));
    }
  } else {
    text = text.replaceAll("Municipality annual net benefit", annualBenefitLabel(project, language));
    text = text.replace(/Municipality-benefit NPV(\s*\([^)]*\))?/g, (_match, suffix = "") => npvLabel(project, language, suffix));
    text = text.replaceAll("Customer / Municipality", partyLabel);
    if (type !== "municipality") {
      const englishSubject = type === "esco_company" ? "customer / ESCO" : "customer";
      text = text.replaceAll("Municipality payback", `${englishSubject} payback`);
      text = text.replaceAll("Municipality NPV", `${englishSubject} NPV`);
      text = text.replaceAll("Municipality VAT impact", `${englishSubject} VAT impact`);
      text = text.replaceAll("Municipality gross CAPEX", `${englishSubject} gross CAPEX`);
      text = text.replaceAll("the municipality funds the initial CAPEX", `the ${englishSubject} funds the initial CAPEX`);
      text = text.replaceAll("cumulative municipality cash flow", `cumulative ${englishSubject} cash flow`);
    }
    if (text.includes("VAT excluded unless otherwise stated.")) {
      text = text.replace("VAT excluded unless otherwise stated.", customerVatDisclosure(project, language));
    }
  }
  return text;
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
