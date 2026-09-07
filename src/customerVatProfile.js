export const CUSTOMER_VAT_TYPES = [
  { id: "unspecified", it: "Da definire", en: "To be defined" },
  { id: "municipality", it: "Comune / ente pubblico", en: "Municipality / public authority" },
  { id: "esco_company", it: "ESCO / impresa", en: "ESCO / company" },
  { id: "other", it: "Altro", en: "Other" },
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

export function customerVatSubject(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const it = language === "it";
  if (type === "municipality") return it ? "Comune" : "municipality";
  if (type === "esco_company") return it ? "cliente / ESCO" : "customer / ESCO";
  return it ? "cliente" : "customer";
}

export function customerVatTypeLabel(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const option = CUSTOMER_VAT_TYPES.find((item) => item.id === type) || CUSTOMER_VAT_TYPES[0];
  return language === "it" ? option.it : option.en;
}

export function customerReportPartyLabel(project = {}, language = "it") {
  const type = normalizeCustomerVatType(project?.customer?.customerType);
  const it = language === "it";
  if (type === "municipality") return it ? "Cliente / Comune" : "Customer / Municipality";
  if (type === "esco_company") return it ? "Cliente / ESCO" : "Customer / ESCO";
  return it ? "Cliente" : "Customer";
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
    return `Valori economici esposti al netto IVA. Tipo cliente: ${typeLabel}. IVA recuperabile dal ${subject}: ${percent}%, secondo le impostazioni del Business Case; aliquote e detraibilità definitive devono essere validate per il singolo contratto.`;
  }
  return `Commercial values are shown net of VAT. Customer type: ${typeLabel}. VAT recoverable by the ${subject}: ${percent}%, according to the Business Case settings; final VAT rates and recoverability must be validated for the individual contract.`;
}
