const fs = require('fs');
const path = 'src/App.jsx';
let s = fs.readFileSync(path, 'utf8');

const oldFilter = '  const partner = String(cmsPartner || "").trim().toUpperCase();\n  const allSmart = p.catalogue?.smart || [];\n  const products = allSmart.filter((x) => String(x.type || "").toLowerCase() === "other" && x.active !== false && (!partner || cmsProductPartner(x) === partner));';
const newFilter = '  const allSmart = p.catalogue?.smart || [];\n  const products = allSmart.filter((x) => String(x.type || "").toLowerCase() === "other" && x.active !== false);';
if (!s.includes(oldFilter) && !s.includes(newFilter)) throw new Error('Partner equipment supplier filter anchor not found');
s = s.replace(oldFilter, newFilter);

const oldAdd = '  const add = () => replaceRows([...rows, { id: uid(), productId: products[0]?.id || "", quantity: 1 }]);';
const newAdd = '  const add = () => replaceRows([...rows, { id: uid(), productId: "", quantity: 1 }]);';
if (!s.includes(oldAdd) && !s.includes(newAdd)) throw new Error('Partner equipment add anchor not found');
s = s.replace(oldAdd, newAdd);

const legacyOptions = '<label><span>{p.language === "it" ? "Prodotto partner" : "Partner product"}</span><select value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}><option value="">-- select product --</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} {item.supplierSku ? `· ${item.supplierSku}` : ""}</option>)}</select></label>';
const currentOptions = '<label><span>{p.language === "it" ? "Prodotto partner" : "Partner product"}</span><select value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}><option value="">{p.language === "it" ? "-- seleziona prodotto --" : "-- select product --"}</option>{products.filter((item) => item.id === row.productId || !rows.some((other, otherIndex) => otherIndex !== index && other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} {item.supplierSku ? `· ${item.supplierSku}` : ""}</option>)}</select></label>';
const supplierOptions = '<label><span>{p.language === "it" ? "Prodotto / fornitore" : "Product / supplier"}</span><select value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}><option value="">{p.language === "it" ? "-- seleziona prodotto --" : "-- select product --"}</option>{products.filter((item) => item.id === row.productId || !rows.some((other, otherIndex) => otherIndex !== index && other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.supplier || item.cmsPartner || item.vendor || "Supplier"} · {item.name} {item.supplierSku ? `· ${item.supplierSku}` : ""}</option>)}</select></label>';
if (!s.includes(legacyOptions) && !s.includes(currentOptions) && !s.includes(supplierOptions)) throw new Error('Partner equipment options anchor not found');
s = s.replace(legacyOptions, supplierOptions).replace(currentOptions, supplierOptions);

const oldButton = '<button type="button" className="secondary" onClick={add} disabled={!products.length}>+ {p.language === "it" ? "Aggiungi prodotto" : "Add product"}</button>';
const newButton = '<button type="button" className="secondary" onClick={add} disabled={!products.some((item) => !rows.some((row) => row.productId === item.id))}>+ {p.language === "it" ? "Aggiungi prodotto" : "Add product"}</button>';
if (!s.includes(oldButton) && !s.includes(newButton)) throw new Error('Partner equipment button anchor not found');
s = s.replace(oldButton, newButton);

const oldHint = '"Selezionare i prodotti hardware del partner. Le quantità entrano nel CAPEX e nella lista ordini del fornitore; i prezzi restano interni."';
const newHint = '"Selezionare i prodotti hardware necessari, anche da fornitori diversi dal CMS Partner. Le quantità entrano nel CAPEX e nelle liste ordini dei rispettivi fornitori; i prezzi restano interni."';
s = s.replace(oldHint, newHint);

fs.writeFileSync(path, s);
