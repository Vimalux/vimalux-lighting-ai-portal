import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import V31ExecutiveDashboard from "./V31ExecutiveDashboard.jsx";
import V31PlatformTools from "./V31PlatformTools.jsx";
import {
  auditRowsToManualGroups,
  calculateManualProject,
  createManualGroup,
  recommendProduct,
} from "./v31ManualProjectEngine.js";

const PRODUCTS = [
  { id: "street20", name: "VIMALUX Street 20", watt: 20, lumen: 3200, sellPrice: 155, buyPrice: 85, install: 35 },
  { id: "street30", name: "VIMALUX Street 30", watt: 30, lumen: 4800, sellPrice: 165, buyPrice: 92, install: 35 },
  { id: "street40", name: "VIMALUX Street 40", watt: 40, lumen: 6400, sellPrice: 175, buyPrice: 100, install: 35 },
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 9600, sellPrice: 190, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 14400, sellPrice: 210, buyPrice: 150, install: 35 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, lumen: 19200, sellPrice: 285, buyPrice: 205, install: 45 },
  { id: "highway150", name: "VIMALUX Highway 150", watt: 150, lumen: 24000, sellPrice: 320, buyPrice: 230, install: 45 },
];

const ASSUMPTIONS = {
  ledSavingPct: 55,
  cloSavingPct: 10,
  smartSolutionSavingPct: 20,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  powerAidAdditionalSavingPct: 35,
  energyPrice: 0.29,
  burningHours: 4200,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  hybridProductionKwhPerLampYear: 70,
  hybridAdditionalCapexPerLamp: 0,
  analysisYears: 20,
  savingIndexationPct: 1.5,
  discountRatePct: 6,
  performanceDegradationPct: 0,
  co2KgPerKwh: 0.233,
  sapBallastFactor: 1.2,
  mhBallastFactor: 1.15,
  mercuryBallastFactor: 1.15,
  fluorescentBallastFactor: 1.1,
  ledBallastFactor: 1,
  unknownBallastFactor: 1,
};

const L = {
  it: {
    title: "VIMALUX Lighting AI Portal", sub: "Versione 31 – Complete Project Platform",
    quick: "Stima rapida", manual: "Progetto manuale", audit: "Import Audit", project: "Progetto",
    municipality: "Comune", contact: "Contatto", qty: "Quantità", watt: "Watt esistente",
    product: "Nuovo prodotto", smart: "Smart", power: "PowerAiD", hybrid: "Hybrid",
    add: "+ Aggiungi gruppo", group: "Gruppo", type: "Tecnologia", duplicate: "Duplica",
    remove: "Elimina", assumptions: "Assunzioni", catalogue: "Catalogo", customer: "Cliente",
    admin: "Admin", importCatalog: "Importa catalogo", recommendation: "Raccomandazione",
  },
  en: {
    title: "VIMALUX Lighting AI Portal", sub: "Version 31 – Complete Project Platform",
    quick: "Quick estimate", manual: "Manual project", audit: "Audit import", project: "Project",
    municipality: "Municipality", contact: "Contact", qty: "Quantity", watt: "Existing wattage",
    product: "New product", smart: "Smart", power: "PowerAiD", hybrid: "Hybrid",
    add: "+ Add group", group: "Group", type: "Technology", duplicate: "Duplicate",
    remove: "Delete", assumptions: "Assumptions", catalogue: "Catalogue", customer: "Customer",
    admin: "Admin", importCatalog: "Import catalogue", recommendation: "Recommendation",
  },
};

const num = (value) => Number(String(value ?? "").replace(",", ".")) || 0;
const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(num(value));
const dec = (value, digits = 1) => new Intl.NumberFormat("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num(value));

export default function AppV31Complete() {
  const [lang, setLang] = useState("it");
  const [admin, setAdmin] = useState(false);
  const [mode, setMode] = useState("quick");
  const [project, setProject] = useState({ municipality: "", contact: "", country: "Italy" });
  const [products, setProducts] = useState(PRODUCTS);
  const [assumptions, setAssumptions] = useState(ASSUMPTIONS);
  const [groups, setGroups] = useState([
    createManualGroup(1, {
      label: "Street lighting", quantity: 500, existingType: "SAP", existingWatt: 100,
      productId: "street40", recommendationTargetWatt: 40, recommendationConfidence: 85,
      smart: true, powerAid: true, hybrid: false,
    }),
  ]);
  const auditRef = useRef(null);
  const catalogRef = useRef(null);
  const t = L[lang];
  const calculation = useMemo(() => calculateManualProject(groups, assumptions, products), [groups, assumptions, products]);

  const updateGroup = (id, key, value) => setGroups((current) => current.map((group) => group.id === id ? { ...group, [key]: value } : group));
  const addGroup = (source) => setGroups((current) => [...current, createManualGroup(current.length + 1, source || { productId: products[0]?.id || "" })]);

  const applyRecommendation = (id) => {
    setGroups((current) => current.map((group) => {
      if (group.id !== id) return group;
      const recommendation = recommendProduct(group.existingType, group.existingWatt, products);
      return {
        ...group,
        productId: recommendation.productId || group.productId,
        recommendationTargetWatt: recommendation.targetWatt,
        recommendationConfidence: recommendation.confidence,
        recommendationMethod: recommendation.method,
      };
    }));
  };

  async function importAudit(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const normalized = rows.map((row, index) => ({
      label: row.Group || row.group || row.Name || row.name || row.ID || row.Id || `Group ${index + 1}`,
      quantity: num(row.Quantity || row.quantity || row.Qty || row.qty || 1),
      existingType: row.Existing_Type || row.existingType || row.Technology || row.Tecnologia || row.Type || row.type || "Unknown",
      existingWatt: num(row.Existing_Watt || row.existingWatt || row.Wattage || row.Watt || row.watt || row.Power || row.power),
    })).filter((row) => row.existingWatt > 0);

    const importedGroups = auditRowsToManualGroups(normalized, products);
    if (importedGroups.length) setGroups(importedGroups);
    setMode("manual");
    event.target.value = "";
  }

  async function importCatalogue(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const imported = rows.map((row, index) => ({
      id: `p-${Date.now()}-${index}`,
      name: String(row.Name || row.name || row.Product || row.product || `Product ${index + 1}`),
      watt: num(row.Watt || row.watt), lumen: num(row.Lumen || row.lumen),
      sellPrice: num(row.Sell || row.sellPrice || row.Price || row.price),
      buyPrice: num(row.Buy || row.buyPrice || row.Cost || row.cost),
      install: num(row.Install || row.install),
    })).filter((product) => product.watt > 0);
    if (imported.length) {
      setProducts(imported);
      setGroups((current) => current.map((group) => {
        const recommendation = recommendProduct(group.existingType, group.existingWatt, imported);
        return { ...group, productId: recommendation.productId || imported[0].id };
      }));
    }
    event.target.value = "";
  }

  const first = groups[0];

  return <div style={s.page}>
    <header style={s.header}>
      <div><h1 style={s.title}>{t.title}</h1><div style={s.muted}>{t.sub}</div></div>
      <div style={s.actions}>
        <button className="v31-button" onClick={() => setAdmin(false)}>{t.customer}</button>
        <button className="v31-button" onClick={() => setAdmin(true)}>{t.admin}</button>
        <button className="v31-button" onClick={() => setLang(lang === "it" ? "en" : "it")}>{lang === "it" ? "EN" : "IT"}</button>
      </div>
    </header>

    <nav style={s.nav}>{[["quick", t.quick], ["manual", t.manual], ["audit", t.audit]].map(([id, label]) =>
      <button key={id} style={mode === id ? s.activeTab : s.tab} onClick={() => { setMode(id); if (id === "audit") auditRef.current?.click(); }}>{label}</button>
    )}</nav>
    <input hidden ref={auditRef} type="file" accept=".xlsx,.xls,.csv" onChange={importAudit} />
    <input hidden ref={catalogRef} type="file" accept=".xlsx,.xls,.csv" onChange={importCatalogue} />

    <section style={s.kpis}>
      <Kpi label={t.qty} value={dec(calculation.totals.quantity, 0)} />
      <Kpi label="CAPEX" value={money(calculation.totals.totalCapex)} />
      <Kpi label={lang === "it" ? "Risparmio annuo" : "Annual saving"} value={money(calculation.totals.annualNetSaving)} />
      <Kpi label="Payback" value={calculation.totals.payback ? `${dec(calculation.totals.payback)} y` : "–"} />
      <Kpi label={lang === "it" ? "Riduzione energia" : "Energy reduction"} value={`${dec(calculation.totals.energyReductionPct)}%`} />
      <Kpi label="CO₂" value={`${dec(calculation.finance.annualCo2Tonnes)} t/y`} />
    </section>

    <V31ExecutiveDashboard calculation={calculation} lang={lang} />
    <V31PlatformTools lang={lang} project={project} setProject={setProject} groups={groups} setGroups={setGroups} assumptions={assumptions} setAssumptions={setAssumptions} products={products} setProducts={setProducts} calculation={calculation} />

    <section style={s.card}>
      <h2>{t.project}</h2>
      <div style={s.formGrid}>
        <Field label={t.municipality} value={project.municipality} onChange={(value) => setProject((state) => ({ ...state, municipality: value }))} />
        <Field label={t.contact} value={project.contact} onChange={(value) => setProject((state) => ({ ...state, contact: value }))} />
        <Field label="Country" value={project.country} onChange={(value) => setProject((state) => ({ ...state, country: value }))} />
      </div>
    </section>

    {mode === "quick" && first && <section style={s.card}>
      <h2>{t.quick}</h2>
      <div style={s.formGrid}>
        <Field numeric label={t.qty} value={first.quantity} onChange={(value) => updateGroup(first.id, "quantity", num(value))} />
        <Field numeric label={t.watt} value={first.existingWatt} onChange={(value) => updateGroup(first.id, "existingWatt", num(value))} />
        <Select label={t.product} value={first.productId} onChange={(value) => updateGroup(first.id, "productId", value)} options={products.map((product) => ({ value: product.id, label: `${product.name} · ${product.watt}W` }))} />
        <button onClick={() => applyRecommendation(first.id)}>{t.recommendation}</button>
        <Toggle label={t.smart} checked={first.smart} onChange={(value) => updateGroup(first.id, "smart", value)} />
        <Toggle label={t.power} checked={first.powerAid} disabled={!first.smart} onChange={(value) => updateGroup(first.id, "powerAid", value)} />
        <Toggle label={t.hybrid} checked={first.hybrid} onChange={(value) => updateGroup(first.id, "hybrid", value)} />
      </div>
    </section>}

    {mode === "manual" && <section style={s.card}>
      <div style={s.sectionHead}><h2>{t.manual}</h2><button onClick={() => addGroup()}>{t.add}</button></div>
      <div style={s.notice}>{lang === "it" ? "Le raccomandazioni sono preliminari e devono essere validate rispetto a UNI 11248, geometria stradale, altezza palo, interasse e ottica." : "Recommendations are preliminary and must be validated against UNI 11248, road geometry, pole height, spacing and optics."}</div>
      <div style={s.tableWrap}><table style={s.table}>
        <thead><tr><th>{t.group}</th><th>{t.qty}</th><th>{t.type}</th><th>{t.watt}</th><th>{t.recommendation}</th><th>{t.product}</th><th>{t.smart}</th><th>{t.power}</th><th>{t.hybrid}</th><th /></tr></thead>
        <tbody>{groups.map((group) => <tr key={group.id}>
          <td><input value={group.label} onChange={(event) => updateGroup(group.id, "label", event.target.value)} /></td>
          <td><input value={group.quantity} onChange={(event) => updateGroup(group.id, "quantity", num(event.target.value))} /></td>
          <td><input value={group.existingType} onChange={(event) => updateGroup(group.id, "existingType", event.target.value)} /></td>
          <td><input value={group.existingWatt} onChange={(event) => updateGroup(group.id, "existingWatt", num(event.target.value))} /></td>
          <td><button onClick={() => applyRecommendation(group.id)}>{group.recommendationTargetWatt ? `${group.recommendationTargetWatt}W · ${group.recommendationConfidence}%` : t.recommendation}</button></td>
          <td><select value={group.productId} onChange={(event) => updateGroup(group.id, "productId", event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.watt}W</option>)}</select></td>
          <td><input type="checkbox" checked={group.smart} onChange={(event) => updateGroup(group.id, "smart", event.target.checked)} /></td>
          <td><input type="checkbox" checked={group.powerAid} disabled={!group.smart} onChange={(event) => updateGroup(group.id, "powerAid", event.target.checked)} /></td>
          <td><input type="checkbox" checked={group.hybrid} onChange={(event) => updateGroup(group.id, "hybrid", event.target.checked)} /></td>
          <td><button onClick={() => { const { id, ...copy } = group; addGroup({ ...copy, label: `${group.label} copy` }); }}>{t.duplicate}</button><button onClick={() => setGroups((current) => current.length > 1 ? current.filter((item) => item.id !== group.id) : current)}>{t.remove}</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    {admin && <section style={s.adminGrid}>
      <div style={s.card}><h2>{t.assumptions}</h2><div style={s.formGrid}>{Object.entries(assumptions).map(([key, value]) => <Field key={key} numeric label={key} value={value} onChange={(nextValue) => setAssumptions((state) => ({ ...state, [key]: num(nextValue) }))} />)}</div></div>
      <div style={s.card}>
        <div style={s.sectionHead}><h2>{t.catalogue}</h2><button onClick={() => catalogRef.current?.click()}>{t.importCatalog}</button></div>
        {products.map((product, index) => <div style={s.productRow} key={product.id}>
          <input value={product.name} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
          {["watt", "lumen", "sellPrice", "buyPrice", "install"].map((key) => <input key={key} value={product[key]} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: num(event.target.value) } : item))} />)}
        </div>)}
      </div>
    </section>}
  </div>;
}

function Kpi({ label, value }) { return <div style={s.kpi}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, value, onChange, numeric }) { return <label style={s.field}><span>{label}</span><input inputMode={numeric ? "decimal" : "text"} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label style={s.field}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Toggle({ label, checked, onChange, disabled }) { return <label style={s.toggle}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>; }

const s = {
  page: { minHeight: "100vh", background: "#f4f7fb", color: "#172033", fontFamily: "Inter, Arial, sans-serif", padding: 24 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 },
  title: { margin: 0, fontSize: 30 }, muted: { color: "#667085", marginTop: 4 }, actions: { display: "flex", gap: 8 },
  nav: { display: "flex", gap: 8, marginBottom: 18 }, tab: { padding: "10px 16px", border: "1px solid #d0d5dd", background: "white", borderRadius: 8 },
  activeTab: { padding: "10px 16px", border: "1px solid #172033", background: "#172033", color: "white", borderRadius: 8 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: "white", border: "1px solid #e4e7ec", borderRadius: 12, padding: 16, display: "grid", gap: 8 },
  card: { background: "white", border: "1px solid #e4e7ec", borderRadius: 14, padding: 20, marginTop: 18 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 },
  field: { display: "grid", gap: 6 }, toggle: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  tableWrap: { overflowX: "auto" }, table: { width: "100%", borderCollapse: "collapse", minWidth: 1100 },
  notice: { padding: 12, background: "#fff7e6", border: "1px solid #fedf89", borderRadius: 8, margin: "10px 0 14px", fontSize: 13 },
  adminGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },
  productRow: { display: "grid", gridTemplateColumns: "2fr repeat(5,1fr)", gap: 8, marginBottom: 8 },
};
