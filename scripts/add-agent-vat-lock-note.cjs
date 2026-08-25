const fs = require('fs');

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`Agent VAT note patch target not found in ${path}: ${before.slice(0, 100)}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source);
}

patch('src/App.jsx', [[
  '{view === "business" && <Business p={project} r={result} t={t} money={money} num={num} />}',
  '{view === "business" && <Business p={project} r={result} t={t} money={money} num={num} isAgent={isAgent} />}'
], [
  'function Business({ p, r, t, money, num }) {',
  'function Business({ p, r, t, money, num, isAgent = false }) {'
], [
  '<VatSummaryCard p={p} r={r} />',
  '<VatSummaryCard p={p} r={r} isAgent={isAgent} />'
]]);

patch('src/VatSettings.jsx', [[
  'export function VatSummaryCard({ p, r }) {',
  'export function VatSummaryCard({ p, r, isAgent = false }) {'
], [
  '    <h2>{it ? "Impatto IVA per il Comune" : "Municipality VAT impact"}</h2>\n    <div className="kpis">',
  '    <h2>{it ? "Impatto IVA per il Comune" : "Municipality VAT impact"}</h2>\n    {isAgent && <p className="hint"><strong>{it ? "Parametri IVA gestiti da VIMALUX." : "VAT assumptions managed by VIMALUX."}</strong> {it ? "I valori sono visibili per la presentazione al Comune ma non sono modificabili dall’account agente." : "Values are visible for presentation to the municipality but cannot be changed from an agent account."}</p>}\n    <div className="kpis">'
]]);

console.log('Agent VAT lock note integrated');
