const fs = require('fs');

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`VAT patch target not found in ${path}: ${before.slice(0, 100)}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source);
}

patch('src/model.js', [[
  'discountRate: 5, freightCostPerLamp: 4',
  'discountRate: 5, vatRecoverability: "non_deductible", vatRecoverablePercent: 0, vatHardwarePercent: 22, vatDigitalPercent: 22, vatMaintenancePercent: 22, vatStructuralPercent: 10, freightCostPerLamp: 4'
]]);

patch('src/App.jsx', [
  [
    'import WarrantySelector from "./WarrantySelector.jsx";',
    'import WarrantySelector from "./WarrantySelector.jsx";\nimport VatSettings, { VatSummaryCard } from "./VatSettings.jsx";'
  ],
  [
    '  "minimumMarginPercent",\n  "closingProbability",',
    '  "minimumMarginPercent",\n  "vatRecoverablePercent",\n  "vatHardwarePercent",\n  "vatDigitalPercent",\n  "vatMaintenancePercent",\n  "vatStructuralPercent",\n  "closingProbability",'
  ],
  [
    '</Card>)}<AdditionalCostsCard p={p} update={update} /><Card className="dimming-card"',
    '</Card>)}<VatSettings p={p} r={r} update={update} /><AdditionalCostsCard p={p} update={update} /><Card className="dimming-card"'
  ],
  [
    '<Kpis p={p} r={r} t={t} money={money} num={num} /><div className="two-col">',
    '<Kpis p={p} r={r} t={t} money={money} num={num} /><VatSummaryCard p={p} r={r} /><div className="two-col">'
  ]
]);

patch('src/businessCaseSync.js', [
  [
    'import { applyWarrantyPricing, projectWarranty } from "./warranty.js";',
    'import { applyWarrantyPricing, projectWarranty } from "./warranty.js";\nimport { calculateVatSummary } from "./vat.js";'
  ],
  [
    '  const warranty = projectWarranty(project);',
    '  const warranty = projectWarranty(project);\n  const vat = calculateVatSummary(project, result);'
  ],
  [
    '    capex: result.totalCapex,\n    annualContractRevenue:',
    '    capex: result.totalCapex,\n    vatRecoverability: vat.mode,\n    vatRecoverablePercent: vat.recoverablePercent,\n    capexVat: vat.capexVat,\n    unrecoverableCapexVat: vat.unrecoverableCapexVat,\n    municipalityCapexCash: vat.municipalityCapexCash,\n    annualOpexVat: vat.annualOpexVat,\n    unrecoverableAnnualOpexVat: vat.unrecoverableAnnualOpexVat,\n    municipalityAnnualOpexCash: vat.municipalityAnnualOpexCash,\n    municipalityAnnualNetBenefit: vat.municipalityAnnualNetBenefit,\n    municipalityPaybackYears: vat.municipalityPayback,\n    municipalityNpv: vat.municipalityNpv,\n    annualContractRevenue:'
  ]
]);

patch('src/preliminaryProposal.js', [
  [
    'it ? "Investimento iniziale (CAPEX)" : "Initial investment (CAPEX)"',
    'it ? "Investimento iniziale (CAPEX, IVA escl.)" : "Initial investment (CAPEX, excl. VAT)"'
  ],
  [
    'it ? "Servizi annuali / OPEX" : "Annual services / OPEX"',
    'it ? "Servizi annuali / OPEX (IVA escl.)" : "Annual services / OPEX (excl. VAT)"'
  ],
  [
    '[it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],',
    '[it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)],\n      [it ? "IVA CAPEX non recuperabile" : "Unrecoverable CAPEX VAT", money(result.unrecoverableCapexVat, lang)],\n      [it ? "Cash-out CAPEX Comune" : "Municipality CAPEX cash-out", money(result.municipalityCapexCash || result.capex, lang)],\n      [it ? "IVA OPEX annua non recuperabile" : "Unrecoverable annual OPEX VAT", money(result.unrecoverableAnnualOpexVat, lang)],\n      [it ? "Cash-out annuo Comune" : "Municipality annual cash-out", money(result.municipalityAnnualOpexCash || result.annualOpex, lang)],\n      [it ? "Payback Comune" : "Municipality payback", result.municipalityPaybackYears == null ? "-" : `${number(result.municipalityPaybackYears, 1, lang)} ${it ? "anni" : "years"}`],'
  ],
  [
    '[it ? "Periodo servizi" : "Service agreement period",',
    '[it ? "Trattamento IVA Comune" : "Municipality VAT treatment", result.vatRecoverability === "deductible" ? (it ? "Detraibile" : "Deductible") : result.vatRecoverability === "partial" ? `${it ? "Parzialmente detraibile" : "Partially deductible"} (${number(result.vatRecoverablePercent, 0, lang)}%)` : (it ? "Non detraibile" : "Non-deductible")],\n      [it ? "Periodo servizi" : "Service agreement period",'
  ]
]);

console.log('VAT municipality cash-flow model integrated');
