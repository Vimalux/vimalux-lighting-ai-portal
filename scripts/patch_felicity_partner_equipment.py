from pathlib import Path

app = Path("src/App.jsx")
s = app.read_text()

product_anchor = '''function ProductSelect({ label, type, p, value, onChange, cmsPartner }) { const partner = String(cmsPartner || "").trim().toUpperCase(); const products = p.catalogue.smart.filter((x) => x.type === type && x.active && (!partner || cmsProductPartner(x) === partner)); return <Field label={label} value={products.some((x) => x.id === value) ? value : ""} onChange={onChange}><option value="">{partner ? "-- " + partner + ": select product --" : "-- select product --"}</option>{products.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }\n'''

component = '''function PartnerEquipmentSelector({ p, update, cmsPartner }) {
  const partner = String(cmsPartner || "").trim().toUpperCase();
  const allSmart = p.catalogue?.smart || [];
  const products = allSmart.filter((x) => String(x.type || "").toLowerCase() === "other" && x.active !== false && (!partner || cmsProductPartner(x) === partner));
  const rows = Array.isArray(p.solution?.partnerEquipment) ? p.solution.partnerEquipment : [];
  if (!products.length && !rows.length) return null;
  const replaceRows = (next) => update(["solution","partnerEquipment"], next);
  const add = () => replaceRows([...rows, { id: uid(), productId: products[0]?.id || "", quantity: 1 }]);
  const change = (index, field, value) => replaceRows(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const remove = (index) => replaceRows(rows.filter((_, i) => i !== index));
  return <div className="optional-equipment partner-equipment-selector">
    <div className="card-title-row" style={{ marginTop: 14 }}><div><strong>{p.language === "it" ? "Apparecchiature partner / PowerAiD" : "Partner / PowerAiD equipment"}</strong><p className="hint">{p.language === "it" ? "Selezionare i prodotti hardware del partner. Le quantità entrano nel CAPEX e nella lista ordini del fornitore; i prezzi restano interni." : "Select partner hardware products. Quantities feed CAPEX and the supplier order list; prices remain internal."}</p></div><button type="button" className="secondary" onClick={add} disabled={!products.length}>+ {p.language === "it" ? "Aggiungi prodotto" : "Add product"}</button></div>
    {rows.map((row, index) => {
      const selected = allSmart.find((item) => item.id === row.productId);
      return <div className="form-grid" key={row.id || index} style={{ alignItems: "end" }}>
        <label><span>{p.language === "it" ? "Prodotto partner" : "Partner product"}</span><select value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}><option value="">-- select product --</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name} {item.supplierSku ? `· ${item.supplierSku}` : ""}</option>)}</select></label>
        <label><span>{p.language === "it" ? "Quantità" : "Quantity"}</span><input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(e) => change(index, "quantity", numberValue(e.target.value))} /></label>
        <div><small className="hint">{selected ? `${selected.supplier || selected.cmsPartner || selected.vendor || ""}${selected.supplierSku ? ` · ${selected.supplierSku}` : ""}` : ""}</small></div>
        <div><button type="button" className="danger secondary" onClick={() => remove(index)}>{p.language === "it" ? "Rimuovi" : "Remove"}</button></div>
      </div>;
    })}
  </div>;
}
'''

if "function PartnerEquipmentSelector(" not in s:
    if product_anchor not in s:
        raise SystemExit("ProductSelect anchor not found; aborting safely")
    s = s.replace(product_anchor, product_anchor + component, 1)

solution_anchor = '''</div></Card><Card title={p.language === "it" ? "Riepilogo soluzione utilizzata" : "Used solution summary"}>'''
solution_replacement = '''</div><PartnerEquipmentSelector p={p} update={update} cmsPartner={resolveCmsPartner(p)} /></Card><Card title={p.language === "it" ? "Riepilogo soluzione utilizzata" : "Used solution summary"}>'''
if '<PartnerEquipmentSelector p={p} update={update} cmsPartner={resolveCmsPartner(p)} />' not in s:
    if solution_anchor not in s:
        raise SystemExit("Solution insertion anchor not found; aborting safely")
    s = s.replace(solution_anchor, solution_replacement, 1)

old_reset = '''        if (path[0] === "solution" && path[1] === "cmsPartner") next = setPath(next, ["solution", "lcuProductId"], "");'''
new_reset = '''        if (path[0] === "solution" && path[1] === "cmsPartner") {
          next = setPath(next, ["solution", "lcuProductId"], "");
          next = setPath(next, ["solution", "partnerEquipment"], []);
        }'''
if old_reset in s:
    s = s.replace(old_reset, new_reset, 1)
elif 'next = setPath(next, ["solution", "partnerEquipment"], []);' not in s:
    raise SystemExit("CMS partner reset anchor not found; aborting safely")

app.write_text(s)
