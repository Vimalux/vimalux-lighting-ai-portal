
const supportedDealTypes = new Set(["cash", "noleggio_operativo", "finance"]);

export function reportCommercialContext(project, result) {
  const language = ["it", "en", "es", "da"].includes(project.language) ? project.language : "en";
  const savedDealType = project.assumptions?.dealType;
  const dealType = supportedDealTypes.has(result?.dealType)
    ? result.dealType
    : supportedDealTypes.has(savedDealType)
      ? savedDealType
      : "cash";
  const translations = {
    it: {
      cash: "Cash Deal", noleggio_operativo: "Noleggio Operativo", finance: "Soluzione finanziata",
      included: "Incluso",
      allInclusiveFootnote: "* Beneficio netto annuo = beneficio lordo - pagamento annuo all-inclusive (OPEX incluso).",
      financedFootnote: "* Beneficio netto annuo = beneficio lordo - OPEX annuo - pagamento annuo del finanziamento.",
    },
    en: {
      cash: "Cash Deal", noleggio_operativo: "Operating Lease / LaaS", finance: "Finance solution",
      included: "Included",
      allInclusiveFootnote: "* Annual net benefit = gross benefit - all-inclusive annual payment (including OPEX).",
      financedFootnote: "* Annual net benefit = gross benefit - annual OPEX - annual financing payment.",
    },
    es: {
      cash: "Compra directa", noleggio_operativo: "Arrendamiento operativo / LaaS", finance: "Solución financiada",
      included: "Incluido",
      allInclusiveFootnote: "* Beneficio neto anual = beneficio bruto - cuota anual todo incluido (con OPEX).",
      financedFootnote: "* Beneficio neto anual = beneficio bruto - OPEX anual - pago anual de financiación.",
    },
    da: {
      cash: "Kontant køb", noleggio_operativo: "Operationel leasing / LaaS", finance: "Finansieret løsning",
      included: "Inkluderet",
      allInclusiveFootnote: "* Årlig nettogevinst = bruttogevinst - årlig betaling alt inklusive (med OPEX).",
      financedFootnote: "* Årlig nettogevinst = bruttogevinst - årlig OPEX - årlige finansieringsbetalinger.",
    },
  };
  const labels = translations[language];
  const opexIncludedInPayment = dealType === "noleggio_operativo";

  return {
    dealType,
    projectType: labels[dealType],
    financed: dealType !== "cash",
    opexIncludedInPayment,
    includedLabel: labels.included,
    annualNetFootnote: opexIncludedInPayment ? labels.allInclusiveFootnote : labels.financedFootnote,
  };
}
