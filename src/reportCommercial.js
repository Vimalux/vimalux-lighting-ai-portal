
const supportedDealTypes = new Set(["cash", "noleggio_operativo", "finance"]);

export function reportCommercialContext(project, result) {
  const language = project.language === "it" ? "it" : "en";
  const savedDealType = project.assumptions?.dealType;
  const dealType = supportedDealTypes.has(result?.dealType)
    ? result.dealType
    : supportedDealTypes.has(savedDealType)
      ? savedDealType
      : "cash";
  const labels = language === "it"
    ? {
        cash: "Cash Deal",
        noleggio_operativo: "Noleggio Operativo",
        finance: "Soluzione finanziata",
      }
    : {
        cash: "Cash Deal",
        noleggio_operativo: "Operating Lease / LaaS",
        finance: "Finance solution",
      };
  const opexIncludedInPayment = dealType === "noleggio_operativo";

  return {
    dealType,
    projectType: labels[dealType],
    financed: dealType !== "cash",
    opexIncludedInPayment,
    includedLabel: language === "it" ? "Incluso" : "Included",
    annualNetFootnote: opexIncludedInPayment
      ? language === "it"
        ? "* Beneficio netto annuo = beneficio lordo - pagamento annuo all-inclusive (OPEX incluso)."
        : "* Annual net benefit = gross benefit - all-inclusive annual payment (including OPEX)."
      : language === "it"
        ? "* Beneficio netto annuo = beneficio lordo - OPEX annuo - pagamento annuo del finanziamento."
        : "* Annual net benefit = gross benefit - annual OPEX - annual financing payment.",
  };
}
