const copy = {
  it: {
    title: "IVA e cash-flow", intro: "I valori commerciali VIMALUX restano al netto IVA. Questa sezione calcola separatamente l'IVA non recuperabile e il cash-out effettivo del cliente.",
    customerType: "Tipo cliente", recoverableByCustomer: "IVA recuperabile dal cliente", nonrecoverable: "0% · Non recuperabile", recoverable: "100% · Recuperabile", partial: "Parziale / manuale", recoverablePct: "% IVA recuperabile",
    hardware: "IVA hardware / retrofit %", digital: "IVA software / servizi digitali %", maintenance: "IVA manutenzione %", structural: "IVA opere strutturali qualificate %",
    defaultNote: "Il tipo cliente imposta solo un valore predefinito: Comune / ente pubblico = 0%; ESCO / impresa = 100%. La detraibilità resta sempre modificabile manualmente per il singolo contratto.",
    capexNet: "CAPEX netto VIMALUX", capexVat: "IVA CAPEX non recuperabile", capexCash: "Cash-out CAPEX cliente", opexNet: "OPEX annuo netto", opexVat: "IVA OPEX annua non recuperabile", opexCash: "Cash-out annuo cliente",
    civilNote: "Le opere civili sono trattate al tasso strutturale solo quando inserite come Additional Cost con categoria 'opere_civili'. Le aliquote definitive devono essere validate per il singolo contratto.",
    vatImpact: "Impatto IVA", monthlyNet: "Canone mensile netto", monthlyVat: "IVA mensile non recuperabile", monthlyGross: "Canone mensile lordo cliente", financedCapex: "CAPEX progetto / investimento finanziato",
    monthlyFinancing: "Rata mensile finanziamento CAPEX", monthlyService: "OPEX servizi / mese", totalMonthlyNet: "Pagamento mensile netto totale", totalMonthlyGross: "Pagamento mensile lordo totale",
    netCapex: "CAPEX netto", nonrecoverableVat: "IVA non recuperabile", grossCapex: "CAPEX lordo cliente", payback: "Payback cliente", npv: "VAN cliente", years: "anni",
  },
  en: {
    title: "VAT & customer cash-flow", intro: "VIMALUX commercial values remain net of VAT. This section separately calculates unrecoverable VAT and the customer's effective cash-out.",
    customerType: "Customer type", recoverableByCustomer: "VAT recoverable by customer", nonrecoverable: "0% · Non-recoverable", recoverable: "100% · Recoverable", partial: "Partial / manual", recoverablePct: "% recoverable VAT",
    hardware: "Hardware / retrofit VAT %", digital: "Software / digital services VAT %", maintenance: "Maintenance VAT %", structural: "Qualified structural works VAT %",
    defaultNote: "Customer type only sets a default: municipality / public authority = 0%; ESCO / company = 100%. Recoverability always remains manually editable for the individual contract.",
    capexNet: "VIMALUX net CAPEX", capexVat: "Unrecoverable CAPEX VAT", capexCash: "Customer CAPEX cash-out", opexNet: "Net annual OPEX", opexVat: "Unrecoverable annual OPEX VAT", opexCash: "Customer annual cash-out",
    civilNote: "Civil works use the structural rate only when entered as an Additional Cost with category 'opere_civili'. Final rates must be validated for the individual contract.",
    vatImpact: "VAT impact", monthlyNet: "Net monthly payment", monthlyVat: "Unrecoverable monthly VAT", monthlyGross: "Gross monthly customer payment", financedCapex: "Project CAPEX / financed investment",
    monthlyFinancing: "Monthly CAPEX financing payment", monthlyService: "Service OPEX / month", totalMonthlyNet: "Total net monthly payment", totalMonthlyGross: "Total gross monthly payment",
    netCapex: "Net CAPEX", nonrecoverableVat: "Unrecoverable VAT", grossCapex: "Customer gross CAPEX", payback: "Customer payback", npv: "Customer NPV", years: "years",
  },
  da: {
    title: "Moms og kundens pengestrøm", intro: "VIMALUX' salgspriser er eksklusive moms. Her beregnes ikke-fradragsberettiget moms og kundens faktiske betaling separat.",
    customerType: "Kundetype", recoverableByCustomer: "Moms, kunden kan fradrage", nonrecoverable: "0% · Intet fradrag", recoverable: "100% · Fuldt fradrag", partial: "Delvist / manuelt", recoverablePct: "Fradragsberettiget moms (%)",
    hardware: "Moms på hardware / retrofit (%)", digital: "Moms på software / digitale tjenester (%)", maintenance: "Moms på vedligehold (%)", structural: "Moms på kvalificerede anlægsarbejder (%)",
    defaultNote: "Kundetypen sætter kun en standardværdi: kommune / offentlig myndighed = 0%; ESCO / virksomhed = 100%. Fradragsretten kan altid redigeres for den enkelte kontrakt.",
    capexNet: "VIMALUX CAPEX ekskl. moms", capexVat: "Ikke-fradragsberettiget CAPEX-moms", capexCash: "Kundens CAPEX-betaling", opexNet: "Årlig OPEX ekskl. moms", opexVat: "Ikke-fradragsberettiget årlig OPEX-moms", opexCash: "Kundens årlige betaling",
    civilNote: "Anlægsarbejder bruger kun den særlige momssats, hvis de er oprettet som en ekstraomkostning i kategorien 'opere_civili'. De endelige satser skal verificeres for hver kontrakt.",
    vatImpact: "Momseffekt", monthlyNet: "Månedlig betaling ekskl. moms", monthlyVat: "Ikke-fradragsberettiget moms pr. måned", monthlyGross: "Månedlig kundebetaling inkl. moms", financedCapex: "Projekt-CAPEX / finansieret investering",
    monthlyFinancing: "Månedlig CAPEX-finansiering", monthlyService: "Service-OPEX / måned", totalMonthlyNet: "Samlet månedsbetaling ekskl. moms", totalMonthlyGross: "Samlet månedsbetaling inkl. moms",
    netCapex: "CAPEX ekskl. moms", nonrecoverableVat: "Ikke-fradragsberettiget moms", grossCapex: "Kundens CAPEX inkl. moms", payback: "Kundens tilbagebetalingstid", npv: "Kundens nutidsværdi", years: "år",
  },
  es: {
    title: "IVA y flujo de caja del cliente", intro: "Los importes comerciales de VIMALUX no incluyen IVA. Este apartado calcula por separado el IVA no recuperable y los desembolsos efectivos del cliente.",
    customerType: "Tipo de cliente", recoverableByCustomer: "IVA recuperable por el cliente", nonrecoverable: "0% · No recuperable", recoverable: "100% · Recuperable", partial: "Parcial / manual", recoverablePct: "IVA recuperable (%)",
    hardware: "IVA de equipos / modernización (%)", digital: "IVA de software / servicios digitales (%)", maintenance: "IVA de mantenimiento (%)", structural: "IVA de obras civiles calificadas (%)",
    defaultNote: "El tipo de cliente solo establece un valor inicial: municipio / entidad pública = 0%; ESCO / empresa = 100%. La recuperabilidad siempre puede ajustarse para cada contrato.",
    capexNet: "CAPEX VIMALUX sin IVA", capexVat: "IVA de CAPEX no recuperable", capexCash: "Desembolso CAPEX del cliente", opexNet: "OPEX anual sin IVA", opexVat: "IVA anual de OPEX no recuperable", opexCash: "Desembolso anual del cliente",
    civilNote: "Las obras civiles solo aplican la tasa estructural cuando se registran como costo adicional en la categoría 'opere_civili'. Las tasas definitivas deben validarse para cada contrato.",
    vatImpact: "Impacto del IVA", monthlyNet: "Cuota mensual sin IVA", monthlyVat: "IVA mensual no recuperable", monthlyGross: "Cuota mensual del cliente con IVA", financedCapex: "CAPEX del proyecto / inversión financiada",
    monthlyFinancing: "Cuota mensual de financiación CAPEX", monthlyService: "OPEX de servicios / mes", totalMonthlyNet: "Pago mensual total sin IVA", totalMonthlyGross: "Pago mensual total con IVA",
    netCapex: "CAPEX sin IVA", nonrecoverableVat: "IVA no recuperable", grossCapex: "CAPEX del cliente con IVA", payback: "Recuperación de la inversión del cliente", npv: "VAN del cliente", years: "años",
  },
};

export function vatT(language, key) {
  return copy[language]?.[key] || copy.en[key] || key;
}

export function vatTranslationCoverage() {
  return Object.fromEntries(Object.entries(copy).map(([language, entries]) => [language, Object.keys(copy.en).filter((key) => !entries[key])]));
}
