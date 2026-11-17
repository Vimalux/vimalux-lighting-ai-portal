export const CUSTOMER_VAT_TYPES = [
  { id: "unspecified", it: "Da definire", en: "To be defined", da: "Afventer afklaring", es: "Por definir" },
  { id: "municipality", it: "Comune / ente pubblico", en: "Municipality / public authority", da: "Kommune / offentlig myndighed", es: "Municipio / entidad pública" },
  { id: "esco_company", it: "ESCO / impresa", en: "ESCO / company", da: "ESCO / virksomhed", es: "ESCO / empresa" },
  { id: "other", it: "Altro", en: "Other", da: "Andet", es: "Otro" },
];

export function normalizeCustomerVatType(value) {
  const type = String(value || "").trim();
  return CUSTOMER_VAT_TYPES.some((item) => item.id === type) ? type : "unspecified";
}

export function vatDefaultForCustomerType(value) {
  const type = normalizeCustomerVatType(value);
  if (type === "municipality") return { mode: "non_deductible", recoverablePercent: 0 };
  if (type === "esco_company") return { mode: "deductible", recoverablePercent: 100 };
  return null;
}

// Change type and its existing VAT defaults together; never accept financial inputs.
export function projectWithCustomerVatType(project, value) {
  const customerType = normalizeCustomerVatType(value);
  const defaults = vatDefaultForCustomerType(customerType);
  return {
    ...project,
    customer: { ...project.customer, customerType },
    assumptions: defaults ? {
      ...project.assumptions,
      vatRecoverability: defaults.mode,
      vatRecoverablePercent: defaults.recoverablePercent,
    } : project.assumptions,
  };
}

export function customerVatSubject(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const copy = {
    it: { municipality: "Comune", esco_company: "cliente / ESCO", other: "cliente" },
    en: { municipality: "municipality", esco_company: "customer / ESCO", other: "customer" },
    da: { municipality: "kommunen", esco_company: "kunden / ESCO", other: "kunden" },
    es: { municipality: "municipio", esco_company: "cliente / ESCO", other: "cliente" },
  }[language] || { municipality: "municipality", esco_company: "customer / ESCO", other: "customer" };
  return copy[type] || copy.other;
}

export function customerVatTypeLabel(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const option = CUSTOMER_VAT_TYPES.find((item) => item.id === type) || CUSTOMER_VAT_TYPES[0];
  return option[language] || option.en;
}

export function customerReportPartyLabel(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const copy = {
    it: { municipality: "Cliente / Comune", esco_company: "Cliente / ESCO", other: "Cliente" },
    en: { municipality: "Customer / Municipality", esco_company: "Customer / ESCO", other: "Customer" },
    da: { municipality: "Kunde / kommune", esco_company: "Kunde / ESCO", other: "Kunde" },
    es: { municipality: "Cliente / municipio", esco_company: "Cliente / ESCO", other: "Cliente" },
  }[language] || { municipality: "Customer / Municipality", esco_company: "Customer / ESCO", other: "Customer" };
  return copy[type] || copy.other;
}

export function vatRecoverablePercent(project = {}) {
  const assumptions = project?.assumptions || {};
  const mode = String(assumptions.vatRecoverability || "").trim();
  if (mode === "deductible") return 100;
  if (mode === "non_deductible") return 0;
  if (mode === "partial") {
    const value = Number(assumptions.vatRecoverablePercent);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  }
  const fallback = vatDefaultForCustomerType(project?.customer?.customerType);
  return fallback?.recoverablePercent ?? 0;
}

export function customerVatDisclosure(project = {}, language = "it") {
  const it = language === "it";
  const subject = customerVatSubject(project, language);
  const percent = vatRecoverablePercent(project);
  const typeLabel = customerVatTypeLabel(project, language);
  if (it) {
    return `Valori al netto IVA, salvo dove espressamente indicato IVA inclusa. Tipo cliente: ${typeLabel}. IVA recuperabile dal ${subject}: ${percent}%, secondo le impostazioni del Business Case; aliquote e detraibilità definitive devono essere validate per il singolo contratto.`;
  }
  if (language === "es") {
    return `Los importes se indican sin IVA, salvo cuando se especifique expresamente que lo incluyen. Tipo de cliente: ${typeLabel}. IVA recuperable por el ${subject}: ${percent}%, conforme a la configuración del proyecto; las tasas y la recuperabilidad definitivas deben validarse para cada contrato.`;
  }
  if (language === "da") {
    return `Beløb er eksklusive moms, medmindre andet udtrykkeligt er angivet. Kundetype: ${typeLabel}. Momsfradrag for ${subject}: ${percent}% ifølge projektets forudsætninger. Endelige satser og fradragsret skal verificeres for den enkelte kontrakt.`;
  }
  return `Values are shown net of VAT unless expressly stated as VAT inclusive. Customer type: ${typeLabel}. VAT recoverable by the ${subject}: ${percent}%, according to the Business Case settings; final VAT rates and recoverability must be validated for the individual contract.`;
}
