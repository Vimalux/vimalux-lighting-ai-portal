import React, { useMemo, useState } from "react";
import { uid } from "./model.js";
import { normalizeCatalogueProduct } from "./productCatalogue.js";
import { catalogueWarranty } from "./warranty.js";
import { mergeCatalogueProducts, readProductCatalogueWorkbook } from "./catalogueImport.js";
import ProcurementPanel from "./ProcurementPanel.jsx";
import HybridSummary from "./HybridSummary.jsx";

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
    <label><span>CCT/CRI Code</span><input value={product.cctCriCode || ""} onChange={(e) => set("cctCriCode", e.target.value.trim())} placeholder="730 / 740 / 830 / 840" /></label>
    <label><span>IP</span><input value={product.ip || ""} onChange={(e) => set("ip", e.target.value)} placeholder="IP66" /></label>
    <label><span>IK</span><input value={product.ik || ""} onChange={(e) => set("ik", e.target.value)} placeholder="IK09" /></label>
    <label><span>{it ? "Classe protezione" : "Protection class"}</span><input value={product.protectionClass || ""} onChange={(e) => set("protectionClass", e.target.value)} placeholder="Class II" /></label>
    <label><span>{it ? "Vita utile (h)" : "Lifetime (h)"}</span><NumericField value={product.lifetime || 0} onChange={(v) => set("lifetime", v)} /></label>
    <label className="catalogue-checkbox"><span>{it ? "Compatibile Zhaga" : "Zhaga capable"}</span><input type="checkbox" checked={yesNo(product.zhaga)} onChange={(e) => set("zhaga", e.target.checked)} /></label>
    <label className="catalogue-checkbox"><span>{it ? "Compatibile D4i" : "D4i capable"}</span><input type="checkbox" checked={yesNo(product.d4iDriver)} onChange={(e) => set("d4iDriver", e.target.checked)} /></label>
    <label className="catalogue-url"><span>{it ? "Riferimento fotometria / Planner" : "Photometry / Planner reference"}</span><input value={product.photometryUrl || ""} onChange={(e) => set("photometryUrl", e.target.value)} /></label>
    <label className="catalogue-url"><span>{it ? "Scheda tecnica / certificati URL" : "Tech sheet / certs URL"}</span><input value={product.techSheetUrl || ""} onChange={(e) => set("techSheetUrl", e.target.value)} /></label>
    <label className="catalogue-checkbox"><span>{it ? "Apparecchio ibrido" : "Hybrid luminaire"}</span><input type="checkbox" checked={yesNo(product.hybrid)} onChange={(e) => set("hybrid", e.target.checked)} /></label>
    {product.hybrid && <>
      <label><span>PV (Wp)</span><NumericField value={product.pvWp || 0} onChange={(v) => set("pvWp", v)} /></label>
      <label><span>{it ? "Batteria (Wh)" : "Battery (Wh)"}</span><NumericField value={product.batteryWh || 0} onChange={(v) => set("batteryWh", v)} /></label>
      <label><span>{it ? "Batteria utilizzabile (Wh)" : "Usable battery (Wh)"}</span><NumericField value={product.usableBatteryWh || 0} onChange={(v) => set("usableBatteryWh", v)} /></label>
      <label><span>{it ? "Potenza modalità solare (W)" : "Solar mode power (W)"}</span><NumericField value={product.solarModeW || 0} onChange={(v) => set("solarModeW", v)} /></label>
      <label><span>{it ? "Peso installato (kg)" : "Installed weight (kg)"}</span><NumericField value={product.weightKg || 0} onChange={(v) => set("weightKg", v)} /></label>
      <label><span>{it ? "Efficienza pannello (%)" : "Panel efficiency (%)"}</span><NumericField value={product.pvEfficiencyPercent || 0} onChange={(v) => set("pvEfficiencyPercent", v)} /></label>
      <label><span>{it ? "Efficienza ciclo batteria (%)" : "Battery roundtrip efficiency (%)"}</span><NumericField value={product.batteryRoundtripEfficiencyPercent || 90} onChange={(v) => set("batteryRoundtripEfficiencyPercent", v)} /></label>
      <label className="catalogue-checkbox"><span>MPPT</span><input type="checkbox" checked={yesNo(product.mppt)} onChange={(e) => set("mppt", e.target.checked)} /></label>
      <div className="hint">{product.weightKg > 18 ? (it ? "Peso >18 kg: NON OK per la regola VIMALUX." : "Weight >18 kg: NOT OK under VIMALUX rule.") : product.weightKg === 18 ? (it ? "18 kg: limite massimo; verifica palo consigliata." : "18 kg: maximum limit; pole check recommended.") : product.weightKg > 0 ? (it ? "Peso entro il limite VIMALUX di 18 kg." : "Weight within the VIMALUX 18 kg limit.") : (it ? "Inserire il peso installato totale." : "Enter total installed weight.")}</div>
    </>}
  </div>;
}

export default function CatalogueExtended({ p, update }) {
  const it = p.language === "it";
  const [expanded, setExpanded] = useState({});
  const [importing, setImporting] = useState(false);
  const warranty = catalogueWarranty(p.catalogue);
  const products = useMemo(() => (p.catalogue?.led || []).map(normalizeCatalogueProduct), [p.catalogue?.led]);

  const importCatalogue = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const imported = await readProductCatalogueWorkbook(file);
      const result = mergeCatalogueProducts(p.catalogue?.led || [], imported);
      const summary = it
        ? `Import catalogo: ${result.imported} righe\nAggiornati: ${result.updated}\nNuovi: ${result.added}\nProdotti esistenti mantenuti: ${result.retained}\n\nI prodotti assenti dal file NON verranno eliminati. Continuare?`
        : `Catalogue import: ${result.imported} rows\nUpdated: ${result.updated}\nNew: ${result.added}\nExisting products retained: ${result.retained}\n\nProducts missing from the file will NOT be deleted. Continue?`;
      if (!confirm(summary)) return;
      update(["catalogue", "led"], result.products);
      alert(it
        ? `Catalogo aggiornato. ${result.updated} prodotti aggiornati, ${result.added} aggiunti.`
        : `Catalogue updated. ${result.updated} products updated, ${result.added} added.`);
    } catch (error) {
      alert(`${it ? "Import catalogo non riuscito" : "Catalogue import failed"}:\n${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const addLed = () => update(["catalogue", "led"], [
    ...(p.catalogue?.led || []),
    {
      id: `led-${uid()}`,
      brand: "",
      supplier: "",
      supplierSku: "",
      name: it ? "Nuovo prodotto LED" : "New LED product",
      model: it ? "Nuovo prodotto LED" : "New LED product",
      productCategory: "STREET",
      compatibleExistingCategories: ["STREET"],
      replacementStrategies: ["REPLACE"],
      wattage: 0,
      lumen: 0,
      efficiency: 0,
      cctCriCode: "",
      ip: "",
      ik: "",
      protectionClass: "",
      lifetime: 0,
      zhaga: false,
      d4iDriver: false,
      photometryUrl: "",
      techSheetUrl: "",
      hybrid: false,
      pvWp: 0,
      batteryWh: 0,
      usableBatteryWh: 0,
      solarModeW: 0,
      weightKg: 0,
      pvEfficiencyPercent: 0,
      batteryRoundtripEfficiencyPercent: 90,
      mppt: false,
      costPrice: 0,
      salesPrice: 0,
      active: true,
    },
  ]);

  const addSmart = () => update(["catalogue", "smart"], [
    ...(p.catalogue?.smart || []),
    { id: `smart-${uid()}`, brand: "", supplier: "", supplierSku: "", name: it ? "Nuovo prodotto Smart" : "New Smart product", type: "LCU", costPrice: 0, salesPrice: 0, implementationCost: 0, implementationSalesPrice: 0, annualCost: 0, annualSalesPrice: 0, active: true },
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
            ? "Master catalogo Intelligence. Brand e fornitore restano separati: il brand identifica il prodotto, il fornitore alimenta la lista acquisti del progetto."
            : "Intelligence master catalogue. Brand and supplier remain separate: brand identifies the product, supplier feeds the project procurement list."}</p>
        </div>
        <div className="import-actions">
          <label className="file-button"><input type="file" accept=".xlsx" disabled={importing} onChange={(e) => { importCatalogue(e.target.files?.[0]); e.target.value = ""; }} />{importing ? (it ? "Importazione..." : "Importing...") : (it ? "Importa catalogo Excel" : "Import Excel catalogue")}</label>
          <button className="primary" onClick={addLed}>+ {it ? "Nuovo prodotto" : "New product"}</button>
        </div>
      </div>
      <p className="muted">{it ? "Import sicuro: stesso Product ID = aggiorna; nuovo Product ID = aggiunge; Product ID assente dal nuovo file = mantiene il prodotto esistente." : "Safe import: same Product ID = update; new Product ID = add; Product ID missing from the new file = retain the existing product."}</p>
      <div className="catalogue-warranty-settings">
        <strong>{it ? "Garanzia standard catalogo" : "Catalogue warranty standard"}</strong>
        <label><span>{it ? "Standard (anni)" : "Standard (years)"}</span><NumericField value={warranty.standardYears} onChange={(v) => update(["catalogue", "warranty", "standardYears"], Math.max(1, Math.round(v)))} /></label>
        <label><span>{it ? "Estesa (anni)" : "Extended (years)"}</span><NumericField value={warranty.extendedYears} onChange={(v) => update(["catalogue", "warranty", "extendedYears"], Math.max(1, Math.round(v)))} /></label>
        <label><span>{it ? "Maggiorazione (%)" : "Uplift (%)"}</span><NumericField value={warranty.upliftPercent} onChange={(v) => update(["catalogue", "warranty", "upliftPercent"], Math.max(0, v))} /></label>
        <small>{it ? "Default: 5 anni. La garanzia estesa applica la maggiorazione al prezzo standard LED; il Business Case salva uno snapshot della percentuale utilizzata." : "Default: 5 years. Extended warranty applies the uplift to standard LED sales prices; the Business Case saves a snapshot of the percentage used."}</small>
      </div>
      <div className="table-scroll catalogue-main-table"><table><thead><tr>{[
        "Brand",
        it ? "Fornitore" : "Supplier",
        "Supplier SKU",
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
            <td><input value={source.supplier || ""} onChange={(e) => setLed(index, "supplier", e.target.value)} placeholder={it ? "Fornitore" : "Supplier"} /></td>
            <td><input value={source.supplierSku || ""} onChange={(e) => setLed(index, "supplierSku", e.target.value)} /></td>
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
          {expanded[product.id || index] && <tr className="catalogue-tech-row"><td colSpan="15"><TechnicalDetails product={normalizeCatalogueProduct(source)} index={index} update={update} it={it} /></td></tr>}
        </React.Fragment>;
      })}</tbody></table></div>
    </section>

    <section className="card">
      <div className="catalogue-title-row"><div><h2>Smart Lighting</h2><p className="hint">LCU, Gateway, Antenna, Energy Meter e relativi costi/OPEX.</p></div><button className="primary" onClick={addSmart}>+ {it ? "Nuovo prodotto Smart" : "New Smart product"}</button></div>
      <div className="table-scroll"><table><thead><tr>{["Brand", it ? "Fornitore" : "Supplier", "Supplier SKU", it ? "Prodotto" : "Product", it ? "Tipo" : "Type", it ? "Costo" : "Cost", it ? "Prezzo standard" : "Standard sales", it ? "Costo implementazione" : "Implementation cost", it ? "Prezzo implementazione" : "Implementation sales", it ? "Costo annuo" : "Annual cost", it ? "Prezzo annuo cliente" : "Annual customer sales", it ? "Attivo" : "Active", ""].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>{(p.catalogue?.smart || []).map((x, i) => <tr key={x.id}><td><input value={x.brand || ""} onChange={(e) => update(["catalogue", "smart", i, "brand"], e.target.value)} /></td><td><input value={x.supplier || ""} onChange={(e) => update(["catalogue", "smart", i, "supplier"], e.target.value)} /></td><td><input value={x.supplierSku || ""} onChange={(e) => update(["catalogue", "smart", i, "supplierSku"], e.target.value)} /></td><td><input value={x.name || ""} onChange={(e) => update(["catalogue", "smart", i, "name"], e.target.value)} /></td><td><select value={x.type} onChange={(e) => update(["catalogue", "smart", i, "type"], e.target.value)}>{["LCU", "Gateway", "Antenna", "Energy Meter", "Other"].map((type) => <option key={type} value={type}>{type}</option>)}</select></td><td><NumericField value={x.costPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "costPrice"], v)} /></td><td><NumericField value={x.salesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "salesPrice"], v)} /></td><td><NumericField value={x.implementationCost || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationCost"], v)} /></td><td><NumericField value={x.implementationSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "implementationSalesPrice"], v)} /></td><td><NumericField value={x.annualCost || 0} onChange={(v) => update(["catalogue", "smart", i, "annualCost"], v)} /></td><td><NumericField value={x.annualSalesPrice || 0} onChange={(v) => update(["catalogue", "smart", i, "annualSalesPrice"], v)} /></td><td><input type="checkbox" checked={x.active !== false} onChange={(e) => update(["catalogue", "smart", i, "active"], e.target.checked)} /></td><td><button className="danger" onClick={() => remove("smart", i)}>{it ? "Elimina" : "Delete"}</button></td></tr>)}</tbody></table></div>
    </section>

    <HybridSummary p={p} update={update} />
    <ProcurementPanel p={p} update={update} />
  </>;
}