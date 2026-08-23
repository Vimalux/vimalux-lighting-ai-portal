import React, { useMemo, useState } from "react";
import { uid } from "./model.js";
import { normalizeCatalogueProduct } from "./productCatalogue.js";
import { catalogueWarranty } from "./warranty.js";

const CATEGORIES = ["STREET", "URBAN", "GLOBO", "FLOODLIGHT", "UPLIGHT", "LANTERN", "RETROFIT_KIT", "OTHER"];
const STRATEGIES = ["REPLACE", "RETROFIT", "EITHER"];

const asListText = (value) => Array.isArray(value) ? value.join(", ") : String(value || "");
const parseList = (value) => String(value || "").split(/[,;|]/).map((item) => item.trim().toUpperCase()).filter(Boolean);
const yesNo = (value) => Boolean(value);

function NumericField({ value, onChange }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  React.useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  return <input inputMode="decimal" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onChange(draft === "" ? 0 : Number(String(draft).replace(",", ".")) || 0)} />;
}

function TechnicalDetails({ product, index, update, it }) {
  const set = (field, value) => update(["catalogue", "led", index, field], value);
  return <div className="catalogue-tech-grid">
    <label><span>CCT</span><input value={product.cct || ""} onChange={(e) => set("cct", e.target.value)} placeholder="3000K, 4000K" /></label>
    <label><span>IP</span><input value={product.ip || ""} onChange={(e) => set("ip", e.target.value)} placeholder="IP66" /></label>
    <label><span>IK</span><input value={product.ik || ""} onChange={(e) => set("ik", e.target.value)} placeholder="IK09" /></label>
    <label><span>CRI</span><input value={product.cri || ""} onChange={(e) => set("cri", e.target.value)} placeholder=">=70" /></label>
    <label><span>{it ? "Classe protezione" : "Protection class"}</span><input value={product.protectionClass || ""} onChange={(e) => set("protectionClass", e.target.value)} placeholder="Class II" /></label>
    <label><span>{it ? "Vita utile (h)" : "Lifetime (h)"}</span><NumericField value={product.lifetime || 0} onChange={(v) => set("lifetime", v)} /></label>
    <label className="catalogue-checkbox"><span>{it ? "Compatibile Zhaga" : "Zhaga capable"}</span><input type="checkbox" checked={yesNo(product.zhaga)} onChange={(e) => set("zhaga", e.target.checked)} /></label>
    <label className="catalogue-checkbox"><span>{it ? "Compatibile D4i" : "D4i capable"}</span><input type="checkbox" checked={yesNo(product.d4iDriver)} onChange={(e) => set("d4iDriver", e.target.checked)} /></label>
    <label className="catalogue-url"><span>{it ? "Riferimento fotometria / Planner" : "Photometry / Planner reference"}</span><input value={product.photometryUrl || ""} onChange={(e) => set("photometryUrl", e.target.value)} /></label>
    <label className="catalogue-url"><span>{it ? "Scheda tecnica / certificati URL" : "Tech sheet / certs URL"}</span><input value={product.techSheetUrl || ""} onChange={(e) => set("techSheetUrl", e.target.value)} /></label>
  </div>;
}

export default function CatalogueExtended({ p, update }) {
  const it = p.language === "it";
  const [expanded, setExpanded] = useState({});
  const warranty = catalogueWarranty(p.catalogue);
  const products = useMemo(() => (p.catalogue?.led || []).map(normalizeCatalogueProduct), [p.catalogue?.led]);

  const addLed = () => update(["catalogue", "led"], [
    ...(p.catalogue?.led || []),
    {
      id: `led-${uid()}`,
      brand: "",
      name: it ? "Nuovo prodotto LED" : "New LED product",
      model: it ? "Nuovo prodotto LED" : "New LED product",
      productCategory: "STREET",
      compatibleExistingCategories: ["STREET"],
      replacementStrategies: ["REPLACE"],
      wattage: 0,
      lumen: 0,
      efficiency: 0,
      cct: "",
      ip: "",
      ik: "",
      cri: "",
      protectionClass: "",
      lifetime: 0,
      zhaga: false,
      d4iDriver: false,
      photometryUrl: "",
      techSheetUrl: "",
      costPrice: 0,
      salesPrice: 0,
      active: true,
    },
  ]);

  const addSmart = () => update(["catalogue", "smart"], [
    ...(p.catalogue?.smart || []),
    { id: `smart-${uid()}`, brand: "", name: it ? "Nuovo prodotto Smart" : "New Smart product", type: "LCU", costPrice: 0, salesPrice: 0, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
  ]);

  const remove = (kind, index) => {
    if (confirm(it ? "Eliminare questo prodotto dal catalogo?" : "Delete this product from the catalogue?")) {
      update(["catalogue", kind], p.catalogue[kind].filter((_, i) => i !== index));
    }
  };

  const setLed = (index, field, value) => update(["catalogue", "led", index, field], value);
  const setModel = (index, value) => update(["catalogue", "led", index], { ...p.catalogue.led[index], name: value, model: value });

  return <>
    <section className="card catalogue-card">
      <div className="catalogue-title-row">
        <div>
          <h2>{it ? "Armature LED e Retrofit" : "LED luminaires & Retrofit"}</h2>
          <p className="hint">{it
            ? "Master catalogo Intelligence. Categoria, compatibilità, strategia, prestazioni, prezzi e capability Smart vengono usati nel Business Case; CCT, ottiche, interfaccia, colore e codice variante definitivo vengono configurati in Planner."
            : "Intelligence master catalogue. Category, compatibility, strategy, performance, pricing and Smart capabilities are used in the Business Case; exact CCT, optics, interface, colour and final variant code are configured in Planner."}</p>
        </div>
        <button className="primary" onClick={addLed}>+ {it ? "Nuovo prodotto" : "New product"}</button>
      </div>
      <div className="catalogue-warranty-settings">
        <strong>{it ? "Garanzia standard catalogo" : "Catalogue warranty standard"}</strong>
        <label><span>{it ? "Standard (anni)" : "Standard (years)"}</span><NumericField value={warranty.standardYears} onChange={(v) => update(["catalogue", "warranty", "standardYears"], Math.max(1, Math.round(v)))} /></label>
        <label><span>{it ? "Estesa (anni)" : "Extended (years)"}</span><NumericField value={warranty.extendedYears} onChange={(v) => update(["catalogue", "warranty", "extendedYears"], Math.max(1, Math.round(v)))} /></label>
        <label><span>{it ? "Maggiorazione (%)" : "Uplift (%)"}</span><NumericField value={warranty.upliftPercent} onChange={(v) => update(["catalogue", "warranty", "upliftPercent"], Math.max(0, v))} /></label>
        <small>{it ? "Default: 5 anni. La garanzia estesa applica la maggiorazione al prezzo standard LED; il Business Case salva uno snapshot della percentuale utilizzata." : "Default: 5 years. Extended warranty applies the uplift to standard LED sales prices; the Business Case saves a snapshot of the percentage used."}</small>
      </div>
      <div className="table-scroll catalogue-main-table"><table><thead><tr>{[
        "Brand",
        it ? "Prodotto / Modello" : "Product / Model",
        it ? "Categoria" : "Category",
        it ? "Compatibile con" : "Compatible with",
        it ? "Strategia" : "Strategy",
        "W",
        "lm",
        "lm/W",
        it ? "Costo" : "Cost",
        it ? "Prezzo standard" : "Standard sales",
        it ? "Attivo" : "Active",
        it ? "Tecnica" : "Technical",
        "",
      ].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{products.map((product, index) => {
        const source = p.catalogue.led[index] || product;
        const efficiency = Number(product.efficiency || (Number(product.wattage) > 0 ? Number(product.lumen || 0) / Number(product.wattage) : 0));
        return <React.Fragment key={product.id || index}>
          <tr>
            <td><input value={source.brand || ""} onChange={(e) => setLed(index, "brand", e.target.value)} /></td>
            <td><input value={source.model || source.name || ""} onChange={(e) => setModel(index, e.target.value)} /></td>
            <td><select value={product.productCategory} onChange={(e) => setLed(index, "productCategory", e.target.value)}>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></td>
            <td><input value={asListText(source.compatibleExistingCategories)} placeholder="STREET, URBAN" onChange={(e) => setLed(index, "compatibleExistingCategories", parseList(e.target.value))} /></td>
            <td><input value={asListText(source.replacementStrategies)} placeholder="REPLACE, RETROFIT" onChange={(e) => setLed(index, "replacementStrategies", parseList(e.target.value).filter((item) => STRATEGIES.includes(item)))} /></td>
            <td><NumericField value={source.wattage || 0} onChange={(v) => setLed(index, "wattage", v)} /></td>
            <td><NumericField value={source.lumen || 0} onChange={(v) => setLed(index, "lumen", v)} /></td>
            <td><span className="catalogue-readonly">{Number.isFinite(efficiency) ? efficiency.toFixed(0) : "0"}</span></td>
            <td><NumericField value={source.costPrice || 0} onChange={(v) => setLed(index, "costPrice", v)} /></td>
            <td><NumericField value={source.salesPrice || 0} onChange={(v) => setLed(index, "salesPrice", v)} /></td>
            <td><input type="checkbox" checked={source.active !== false} onChange={(e) => setLed(index, "active", e.target.checked)} /></td>
            <td><button className="secondary" onClick={() => setExpanded((current) => ({ ...current, [product.id || index]: !current[product.id || index] }))}>{expanded[product.id || index] ? (it ? "Chiudi" : "Close") : (it ? "Dettagli" : "Details")}</button></td>
            <td><button className="danger" onClick={() => remove("led", index)}>{it ? "Elimina" : "Delete"}</button></td>
          </tr>
          {expanded[product.id || index] && <tr className="catalogue-tech-row"><td colSpan="13"><TechnicalDetails product={source} index={index} update={update} it={it} /></td></tr>}
        </React.Fragment>;
      })}</tbody></table></div>
    </section>

    <section className="card">
      <div className="catalogue-title-row"><div><h2>Smart Lighting</h2><p className="hint">LCU, Gateway, Antenna, Energy Meter e relativi costi/OPEX.</p></div><button className="primary" onClick={addSmart}>+ {it ? "Nuovo prodotto Smart" : "New Smart product"}</button></div>
      <div className="table-scroll"><table><thead><tr>{["Brand", it ? "Prodotto" : "Product", it ? "Tipo" : "Type", it ? "Costo" : "Cost", it ? "Prezzo standard" : "Standard sales", it ? "Costo implementazione" : "Implementation cost", it ? "Prezzo implementazione" : "Implementation sales", it ? "Costo annuo" : "Annual cost", it ? "Prezzo annuo cliente" : "Annual customer sales", it ? "Attivo" : "Active", ""].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{(p.catalogue?.smart || []).map((x, i) => <tr key={x.id}><td><input value={x.brand || ""} onChange={(e) => update(["catalogue", "smart", i, "brand"], e.target.value)} /></td><td><input value={x.name || ""} onChange={(e) => update(["catalogue", "smart", i, "name"], e.target.value)} /></td><td><select value={x.type} onChange={(e) => update(["catalogue", "smart", i, "type"], e.target.value)}>{["LCU", "Gateway", "Antenna", "Energy Meter", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></td><td><NumericField value={x.costPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "costPrice"], v)} /></td><td><NumericField value={x.salesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "salesPrice"], v)} /></td><td><NumericField value={x.implementationCost || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationCost"], v)} /></td><td><NumericField value={x.implementationSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationSalesPrice"], v)} /></td><td><NumericField value={x.annualCost || 0} onChange={(v) => update(["catalogue", "smart", i, "annualCost"], v)} /></td><td><NumericField value={x.annualSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "annualSalesPrice"], v)} /></td><td><input type="checkbox" checked={x.active !== false} onChange={(e) => update(["catalogue", "smart", i, "active"], e.target.checked)} /></td><td><button className="danger" onClick={() => remove("smart", i)}>{it ? "Elimina" : "Delete"}</button></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
