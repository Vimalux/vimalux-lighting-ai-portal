const fs = require('fs');
const path = 'src/App.jsx';
let source = fs.readFileSync(path, 'utf8');
const before = '<details className="advanced-customer-economics"><summary>{p.language === "it" ? "Dettaglio economico annuale" : "Annual economics detail"}</summary><h3>{p.language === "it" ? "Flusso di cassa cliente" : "Customer cash flow"}</h3><CashTable p={p} r={r} money={money} /></details>';
const after = '<section className="advanced-customer-economics cashflow-visible"><h3>{p.language === "it" ? "Flusso di cassa cliente" : "Customer cash flow"}</h3><p className="hint">{p.language === "it" ? "Dettaglio annuale con beneficio lordo, OPEX, pagamento e flusso netto cliente." : "Annual detail with gross benefit, OPEX, payment and customer net cash flow."}</p><CashTable p={p} r={r} money={money} /></section>';
if (source.includes(before)) source = source.replace(before, after);
else if (!source.includes(after)) throw new Error('Cashflow dashboard patch target not found');
fs.writeFileSync(path, source);
console.log('Cashflow table is visible by default in customer report dashboard');
