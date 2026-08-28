const fs = require('fs');

function replaceOnce(path, before, after) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Number-format patch target not found in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

const helpers = `function activeUiLanguage() { return document.querySelector('select[aria-label="Language"]')?.value || "it"; }\nfunction inputLocale(language) { return language === "da" ? "da-DK" : language === "en" ? "en-IE" : "it-IT"; }\nfunction cleanInputNumber(value) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(6)) : 0; }\nfunction formatInputNumber(value, language = activeUiLanguage()) { const n = Number(value); if (!Number.isFinite(n)) return ""; return new Intl.NumberFormat(inputLocale(language), { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n); }\n`;

replaceOnce(
  'src/App.jsx',
  'function NumericInput({ value, onChange, placeholder, disabled = false }) { const [draft, setDraft] = useState(value == null ? "" : String(value)); useEffect(() => setDraft(value == null ? "" : String(value)), [value]); return <input inputMode="decimal" value={draft} placeholder={placeholder} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={() => onChange(draft)} />; }',
  helpers + 'function NumericInput({ value, onChange, placeholder, disabled = false }) { const [draft, setDraft] = useState(value == null ? "" : String(cleanInputNumber(value))); const [focused, setFocused] = useState(false); useEffect(() => { if (!focused) setDraft(value == null ? "" : String(cleanInputNumber(value))); }, [value, focused]); const display = focused ? draft : (value == null || value === "" ? "" : formatInputNumber(value)); return <input inputMode="decimal" value={display} placeholder={placeholder} disabled={disabled} onFocus={() => { setDraft(value == null ? "" : String(cleanInputNumber(value))); setFocused(true); }} onChange={(e) => setDraft(e.target.value)} onBlur={() => { onChange(draft); setFocused(false); }} />; }'
);

const catalogueBefore = `function NumericField({ value, onChange }) {\n  const [draft, setDraft] = useState(value == null ? "" : String(value));\n  React.useEffect(() => setDraft(value == null ? "" : String(value)), [value]);\n  return <input inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onChange(draft === "" ? 0 : Number(String(draft).replace(",", ".")) || 0)} />;\n}`;
const catalogueAfter = `function parseLocalizedNumber(value) {\n  let text = String(value ?? "").trim().replace(/\\s/g, "");\n  const comma = text.lastIndexOf(",");\n  const dot = text.lastIndexOf(".");\n  if (comma >= 0 && dot >= 0) text = comma > dot ? text.replace(/\\./g, "").replace(",", ".") : text.replace(/,/g, "");\n  else if (comma >= 0) text = text.replace(/\\./g, "").replace(",", ".");\n  const parsed = Number(text);\n  return Number.isFinite(parsed) ? parsed : 0;\n}\nfunction NumericField({ value, onChange, language = "it" }) {\n  const [draft, setDraft] = useState(value == null ? "" : String(Number(Number(value).toFixed(6))));\n  const [focused, setFocused] = useState(false);\n  React.useEffect(() => { if (!focused) setDraft(value == null ? "" : String(Number(Number(value).toFixed(6)))); }, [value, focused]);\n  const locale = language === "en" ? "en-IE" : language === "da" ? "da-DK" : "it-IT";\n  const formatted = value == null || value === "" ? "" : new Intl.NumberFormat(locale, { useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);\n  return <input inputMode="decimal" value={focused ? draft : formatted} onFocus={() => { setDraft(value == null ? "" : String(Number(Number(value).toFixed(6)))); setFocused(true); }} onChange={(event) => setDraft(event.target.value)} onBlur={() => { onChange(parseLocalizedNumber(draft)); setFocused(false); }} />;\n}`;
replaceOnce('src/CatalogueExtended.jsx', catalogueBefore, catalogueAfter);

// Pass the active UI language to catalogue numeric fields without changing every call site manually.
let catalogue = fs.readFileSync('src/CatalogueExtended.jsx', 'utf8');
if (!catalogue.includes('const numericLanguage = p.language;')) {
  catalogue = catalogue.replace('  const it = p.language === "it";','  const it = p.language === "it";\n  const numericLanguage = p.language;');
  catalogue = catalogue.replace(/<NumericField /g, '<NumericField language={numericLanguage} ');
  // TechnicalDetails has no p object; it already receives `it`, so keep its fields Italian/English compatible.
  catalogue = catalogue.replace(/function TechnicalDetails\(\{ product, index, update, it \}\)/, 'function TechnicalDetails({ product, index, update, it })');
  catalogue = catalogue.replace(/<NumericField language=\{numericLanguage\} value=\{product\.lifetime/g, '<NumericField language={it ? "it" : "en"} value={product.lifetime');
  fs.writeFileSync('src/CatalogueExtended.jsx', catalogue);
}

// Keep customer-facing cashflow money formatting identical to the PDF: whole euros with locale grouping.
let app = fs.readFileSync('src/App.jsx', 'utf8');
app = app.replace(
  'function CashTable({ p, r, money }) { const allInclusive = r.dealType === "noleggio_operativo"; const included = p.language === "it" ? "Incluso" : "Included"; const money2 = (value) => formatMoney(value,p.language,p.project.currency,2);',
  'function CashTable({ p, r, money }) { const allInclusive = r.dealType === "noleggio_operativo"; const included = p.language === "it" ? "Incluso" : "Included";'
);
app = app.replace('allInclusive ? included : money2(x.opex)', 'allInclusive ? included : money(x.opex)');
app = app.replace('money2(x.payment)', 'money(x.payment)');
fs.writeFileSync('src/App.jsx', app);

// Make report number helpers explicitly grouped and suppress binary floating-point tails.
for (const path of ['src/preliminaryProposal.js']) {
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('style: "currency", currency: "EUR", maximumFractionDigits: 0,','style: "currency", currency: "EUR", useGrouping: true, maximumFractionDigits: 0,');
  source = source.replace('minimumFractionDigits: digits, maximumFractionDigits: digits,','useGrouping: true, minimumFractionDigits: digits, maximumFractionDigits: digits,');
  fs.writeFileSync(path, source);
}

console.log('Locale-aware number formatting applied across inputs, dashboard cashflow and reports');
