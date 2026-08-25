const fs = require('fs');

const path = 'src/preliminaryProposal.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Customer proposal patch target not found: ${before.slice(0, 120)}`);
  source = source.replace(before, after);
}

replaceOnce(
  '  const it = lang === "it";\n  const lineage =',
  '  const it = lang === "it";\n  const dealType = project.assumptions?.dealType || result.dealType || "cash";\n  const isFinance = dealType === "finance";\n  const isNoleggio = dealType === "noleggio_operativo";\n  const customerFinanced = isFinance || isNoleggio;\n  const upfrontMunicipality = customerFinanced ? Number(project.assumptions?.upfrontPayment || 0) : Number(result.municipalityCapexCash || result.capex || 0);\n  const annualCustomerPayment = Number(result.annualCustomerPayment ?? result.annualContractRevenue ?? 0);\n  const monthlyCustomerPayment = Number(result.monthlyCustomerPayment ?? (annualCustomerPayment / 12));\n  const annualNetSaving = Number(result.annualCustomerNetBenefit || 0);\n  const monthlyNetSaving = annualNetSaving / 12;\n  const positiveFromStart = customerFinanced && annualNetSaving >= 0;\n  const lineage ='
);

const oldSummaryHead = '    head: [[it ? "Investimento iniziale (CAPEX, IVA escl.)" : "Initial investment (CAPEX, excl. VAT)", it ? "Servizi annuali / OPEX (IVA escl.)" : "Annual services / OPEX (excl. VAT)", it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue", it ? `TCV – valore contrattuale totale ${Math.round(Number(result.contractYears) || 0)} anni` : `TCV – total contract value ${Math.round(Number(result.contractYears) || 0)} years`]],\n    body: [[money(result.capex, lang), money(result.annualOpex, lang), money(result.annualContractRevenue, lang), money(result.tcv, lang)]],';
const oldSummaryHeadLegacy = '    head: [[it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)", it ? "Servizi annuali / OPEX" : "Annual services / OPEX", it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue", it ? `TCV – valore contrattuale totale ${Math.round(Number(result.contractYears) || 0)} anni` : `TCV – total contract value ${Math.round(Number(result.contractYears) || 0)} years`]],\n    body: [[money(result.capex, lang), money(result.annualOpex, lang), money(result.annualContractRevenue, lang), money(result.tcv, lang)]],';
const newSummaryHead = '    head: [[customerFinanced ? (it ? "Investimento iniziale Comune" : "Municipality upfront investment") : (it ? "Investimento iniziale (CAPEX, IVA escl.)" : "Initial investment (CAPEX, excl. VAT)"), it ? "Servizi annuali / OPEX (IVA escl.)" : "Annual services / OPEX (excl. VAT)", customerFinanced ? (it ? "Pagamento annuo cliente (IVA escl.)" : "Annual customer payment (excl. VAT)") : (it ? "Investimento / ricavo contrattuale" : "Investment / contract revenue"), customerFinanced ? (it ? "Pagamento mensile cliente (IVA escl.)" : "Monthly customer payment (excl. VAT)") : (it ? `TCV – valore contrattuale totale ${Math.round(Number(result.contractYears) || 0)} anni` : `TCV – total contract value ${Math.round(Number(result.contractYears) || 0)} years`)]],\n    body: [[money(customerFinanced ? upfrontMunicipality : result.capex, lang), money(result.annualOpex, lang), money(customerFinanced ? annualCustomerPayment : result.annualContractRevenue, lang), money(customerFinanced ? monthlyCustomerPayment : result.tcv, lang)]],';
if (source.includes(oldSummaryHead)) source = source.replace(oldSummaryHead, newSummaryHead);
else if (source.includes(oldSummaryHeadLegacy)) source = source.replace(oldSummaryHeadLegacy, newSummaryHead);
else if (!source.includes(newSummaryHead)) throw new Error('Proposal summary KPI table target not found');

replaceOnce(
  '    head: [[it ? "Risparmio netto annuo" : "Annual Net Saving", it ? "Riduzione energia" : "Energy Reduction", it ? "Riduzione CO2" : "CO2 Reduction", "Payback", "NPV"]],\n    body: [[money(result.annualCustomerNetBenefit, lang), `${number(result.energyReductionPct, 1, lang)}%`, `${number(result.co2ReductionTons, 1, lang)} t/yr`, result.paybackYears == null ? "-" : `${number(result.paybackYears, 1, lang)} ${it ? "anni" : "years"}`, money(result.npv, lang)]],',
  '    head: [[it ? "Risparmio netto annuo" : "Annual Net Saving", it ? "Riduzione energia" : "Energy Reduction", it ? "Riduzione CO2" : "CO2 Reduction", customerFinanced ? (it ? "Risparmio netto / mese" : "Net saving / month") : "Payback", customerFinanced ? (it ? "Cash flow positivo dal 1° mese" : "Positive cash flow from month one") : "NPV"]],\n    body: [[money(result.annualCustomerNetBenefit, lang), `${number(result.energyReductionPct, 1, lang)}%`, `${number(result.co2ReductionTons, 1, lang)} t/yr`, customerFinanced ? money(monthlyNetSaving, lang) : (result.paybackYears == null ? "-" : `${number(result.paybackYears, 1, lang)} ${it ? "anni" : "years"}`), customerFinanced ? (positiveFromStart ? (it ? "Sì" : "Yes") : "No") : money(result.npv, lang)]],'
);

// Customer-facing terminology in the commercial structure.
source = source.replace(
  '[it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)", money(result.capex, lang)],',
  '[customerFinanced ? (it ? "Investimento iniziale Comune" : "Municipality upfront investment") : (it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)"), money(customerFinanced ? upfrontMunicipality : result.capex, lang)],'
);
source = source.replace(
  '[it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue", money(result.annualContractRevenue, lang)],',
  '[customerFinanced ? (it ? "Pagamento annuo cliente (IVA escl.)" : "Annual customer payment (excl. VAT)") : (it ? "Ricavo contrattuale annuo" : "Annual Contract Revenue"), money(customerFinanced ? annualCustomerPayment : result.annualContractRevenue, lang)],\n      ...(customerFinanced ? [[it ? "Pagamento mensile cliente (IVA escl.)" : "Monthly customer payment (excl. VAT)", money(monthlyCustomerPayment, lang)]] : []),'
);

// VAT cash-out/payback rows are relevant to a direct cash purchase, not to a fully financed customer view.
source = source.replace(
  '[it ? "IVA CAPEX non recuperabile" : "Unrecoverable CAPEX VAT", money(result.unrecoverableCapexVat, lang)],\n      [it ? "Cash-out CAPEX Comune" : "Municipality CAPEX cash-out", money(result.municipalityCapexCash || result.capex, lang)],',
  '...(customerFinanced ? [] : [[it ? "IVA CAPEX non recuperabile" : "Unrecoverable CAPEX VAT", money(result.unrecoverableCapexVat, lang)], [it ? "Cash-out CAPEX Comune" : "Municipality CAPEX cash-out", money(result.municipalityCapexCash || result.capex, lang)]]),'
);
source = source.replace(
  '[it ? "Payback Comune" : "Municipality payback", result.municipalityPaybackYears == null ? "-" : `${number(result.municipalityPaybackYears, 1, lang)} ${it ? "anni" : "years"}`],',
  '[customerFinanced ? (it ? "Cash flow positivo dal primo anno" : "Positive cash flow from year one") : (it ? "Payback Comune" : "Municipality payback"), customerFinanced ? (positiveFromStart ? (it ? "Sì" : "Yes") : "No") : (result.municipalityPaybackYears == null ? "-" : `${number(result.municipalityPaybackYears, 1, lang)} ${it ? "anni" : "years"}`)],'
);

fs.writeFileSync(path, source);
console.log('Customer finance proposal simplified');
