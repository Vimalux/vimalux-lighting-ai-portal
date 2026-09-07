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
