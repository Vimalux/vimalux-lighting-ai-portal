const fs = require('fs');

const path = 'src/CatalogueExtended.jsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Smart catalogue patch target not found (${label})`);
  source = source.replace(before, after);
}

replaceOnce(
  '  const [importing, setImporting] = useState(false);',
  '  const [importing, setImporting] = useState(false);\n  const [catalogueTab, setCatalogueTab] = useState("led");',
  'catalogue tab state'
);

replaceOnce(
  '{ id: `smart-${uid()}`, brand: "", name: it ? "Nuovo prodotto Smart" : "New Smart product", type: "LCU", costPrice: 0, salesPrice: 0, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },',
  '{ id: `smart-${uid()}`, brand: "", cmsPartner: "", name: it ? "Nuovo prodotto Smart" : "New Smart product", type: "LCU", sku: "", costPrice: 0, salesPrice: 0, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, zhaga: false, d4i: false, connectivity: "", active: true },',
  'new smart product fields'
);

replaceOnce(
  '  return <>\n    <section className="card catalogue-card">',
  `  return <>
    <div className="catalogue-tabs" style={{display:"flex", gap:8, marginBottom:14}}>
      <button className={catalogueTab === "led" ? "primary" : "secondary"} onClick={() => setCatalogueTab("led")}>LED / LUMINAIRES</button>
      <button className={catalogueTab === "smart" ? "primary" : "secondary"} onClick={() => setCatalogueTab("smart")}>SMART / CMS</button>
    </div>
    <section className="card catalogue-card" style={{display: catalogueTab === "led" ? "" : "none"}}>`,
  'catalogue tabs'
);

replaceOnce(
  '    <section className="card">\n      <div className="catalogue-title-row"><div><h2>Smart Lighting</h2><p className="hint">LCU, Gateway, Antenna, Energy Meter e relativi costi/OPEX.</p></div><button className="primary" onClick={addSmart}>+ {it ? "Nuovo prodotto Smart" : "New Smart product"}</button></div>',
  `    <section className="card" style={{display: catalogueTab === "smart" ? "" : "none"}}>
      <div className="catalogue-title-row"><div><h2>SMART / CMS</h2><p className="hint">{it ? "Master catalogo Smart/CMS. Partner/vendor, nodi LCU, gateway, connettività, compatibilità Zhaga/D4i e costi CAPEX/OPEX determinano automaticamente il CMS Partner del progetto." : "Smart/CMS master catalogue. Partner/vendor, LCU nodes, gateways, connectivity, Zhaga/D4i compatibility and CAPEX/OPEX determine the project's CMS Partner automatically."}</p></div><button className="primary" onClick={addSmart}>+ {it ? "Nuovo prodotto Smart" : "New Smart product"}</button></div>`,
  'smart section heading'
);

const oldTable = `      <div className="table-scroll"><table><thead><tr>{["Brand", it ? "Prodotto" : "Product", it ? "Tipo" : "Type", it ? "Costo" : "Cost", it ? "Prezzo standard" : "Standard sales", it ? "Costo implementazione" : "Implementation cost", it ? "Prezzo implementazione" : "Implementation sales", it ? "Costo annuo" : "Annual cost", it ? "Prezzo annuo cliente" : "Annual customer sales", it ? "Attivo" : "Active", ""].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{(p.catalogue?.smart || []).map((x, i) => <tr key={x.id}><td><input value={x.brand || ""} onChange={(e) => update(["catalogue", "smart", i, "brand"], e.target.value)} /></td><td><input value={x.name || ""} onChange={(e) => update(["catalogue", "smart", i, "name"], e.target.value)} /></td><td><select value={x.type} onChange={(e) => update(["catalogue", "smart", i, "type"], e.target.value)}>{["LCU", "Gateway", "Antenna", "Energy Meter", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></td><td><NumericField value={x.costPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "costPrice"], v)} /></td><td><NumericField value={x.salesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "salesPrice"], v)} /></td><td><NumericField value={x.implementationCost || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationCost"], v)} /></td><td><NumericField value={x.implementationSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationSalesPrice"], v)} /></td><td><NumericField value={x.annualCost || 0} onChange={(v) => update(["catalogue", "smart", i, "annualCost"], v)} /></td><td><NumericField value={x.annualSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "annualSalesPrice"], v)} /></td><td><input type="checkbox" checked={x.active !== false} onChange={(e) => update(["catalogue", "smart", i, "active"], e.target.checked)} /></td><td><button className="danger" onClick={() => remove("smart", i)}>{it ? "Elimina" : "Delete"}</button></td></tr>)}</tbody></table></div>`;

const newTable = `      <div className="table-scroll"><table><thead><tr>{[
        it ? "Partner / Vendor" : "Partner / Vendor",
        "Brand",
        it ? "Prodotto" : "Product",
        it ? "Tipo" : "Type",
        "SKU",
        it ? "Costo" : "Cost",
        it ? "Prezzo standard" : "Standard sales",
        it ? "Costo implementazione" : "Implementation cost",
        it ? "Prezzo implementazione" : "Implementation sales",
        it ? "Costo annuo" : "Annual cost",
        it ? "Prezzo annuo cliente" : "Annual customer sales",
        "Zhaga",
        "D4i",
        it ? "Connettività" : "Connectivity",
        it ? "Attivo" : "Active",
        ""
      ].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{(p.catalogue?.smart || []).map((x, i) => {
        const partner = x.cmsPartner || x.vendor || x.manufacturer || ((String(x.brand || "").toUpperCase() === "VIMALUX") ? "DATEK" : x.brand) || "";
        return <tr key={x.id}>
          <td><input value={partner} placeholder="DATEK / Tvilight / Itron / Signify" onChange={(e) => update(["catalogue", "smart", i, "cmsPartner"], e.target.value)} /></td>
          <td><input value={x.brand || ""} onChange={(e) => update(["catalogue", "smart", i, "brand"], e.target.value)} /></td>
          <td><input value={x.name || ""} onChange={(e) => update(["catalogue", "smart", i, "name"], e.target.value)} /></td>
          <td><select value={x.type} onChange={(e) => update(["catalogue", "smart", i, "type"], e.target.value)}>{["LCU", "Gateway", "Antenna", "Energy Meter", "CMS", "Sensor", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></td>
          <td><input value={x.sku || ""} onChange={(e) => update(["catalogue", "smart", i, "sku"], e.target.value)} /></td>
          <td><NumericField value={x.costPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "costPrice"], v)} /></td>
          <td><NumericField value={x.salesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "salesPrice"], v)} /></td>
          <td><NumericField value={x.implementationCost || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationCost"], v)} /></td>
          <td><NumericField value={x.implementationSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationSalesPrice"], v)} /></td>
          <td><NumericField value={x.annualCost || 0} onChange={(v) => update(["catalogue", "smart", i, "annualCost"], v)} /></td>
          <td><NumericField value={x.annualSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "annualSalesPrice"], v)} /></td>
          <td><input type="checkbox" checked={Boolean(x.zhaga)} onChange={(e) => update(["catalogue", "smart", i, "zhaga"], e.target.checked)} /></td>
          <td><input type="checkbox" checked={Boolean(x.d4i ?? x.d4iDriver)} onChange={(e) => update(["catalogue", "smart", i, "d4i"], e.target.checked)} /></td>
          <td><input value={x.connectivity || ""} placeholder="Mesh / NB-IoT / LTE / LoRaWAN" onChange={(e) => update(["catalogue", "smart", i, "connectivity"], e.target.value)} /></td>
          <td><input type="checkbox" checked={x.active !== false} onChange={(e) => update(["catalogue", "smart", i, "active"], e.target.checked)} /></td>
          <td><button className="danger" onClick={() => remove("smart", i)}>{it ? "Elimina" : "Delete"}</button></td>
        </tr>;
      })}</tbody></table></div>`;

replaceOnce(oldTable, newTable, 'smart catalogue table');

fs.writeFileSync(path, source);
console.log('Smart/CMS catalogue tabs patch applied');
