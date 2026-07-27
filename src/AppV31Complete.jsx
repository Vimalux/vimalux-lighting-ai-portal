import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import V31ExecutiveDashboard from "./V31ExecutiveDashboard.jsx";
import V31PlatformTools from "./V31PlatformTools.jsx";
import { calculateManualProject, createManualGroup } from "./v31ManualProjectEngine.js";

const PRODUCTS = [
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 10200, sellPrice: 190, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 15300, sellPrice: 210, buyPrice: 150, install: 35 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, lumen: 20400, sellPrice: 285, buyPrice: 205, install: 45 },
];

const ASSUMPTIONS = {
  ledSavingPct: 55, cloSavingPct: 10, smartSolutionSavingPct: 20,
  maintenanceOldPerLamp: 25, maintenanceSavingPct: 50,
  powerAidAdditionalSavingPct: 35, energyPrice: 0.29, burningHours: 4200,
  smartNodeCost: 62, cmsFeePerLampYear: 6, powerAidFeePerLampYear: 3,
  hybridProductionKwhPerLampYear: 70, hybridAdditionalCapexPerLamp: 0,
  analysisYears: 20, savingIndexationPct: 1.5, discountRatePct: 6,
  performanceDegradationPct: 0, co2KgPerKwh: 0.233,
};

const L = {
  it: { title: "VIMALUX Lighting AI Portal", sub: "Versione 31 – Complete Project Platform", quick: "Stima rapida", manual: "Progetto manuale", audit: "Import Audit", project: "Progetto", municipality: "Comune", contact: "Contatto", qty: "Quantità", watt: "Watt esistente", product: "Nuovo prodotto", smart: "Smart", power: "PowerAiD", hybrid: "Hybrid", add: "+ Aggiungi gruppo", group: "Gruppo", type: "Tecnologia", duplicate: "Duplica", remove: "Elimina", assumptions: "Assunzioni", catalogue: "Catalogo", customer: "Cliente", admin: "Admin", importCatalog: "Importa catalogo" },
  en: { title: "VIMALUX Lighting AI Portal", sub: "Version 31 – Complete Project Platform", quick: "Quick estimate", manual: "Manual project", audit: "Audit import", project: "Project", municipality: "Municipality", contact: "Contact", qty: "Quantity", watt: "Existing wattage", product: "New product", smart: "Smart", power: "PowerAiD", hybrid: "Hybrid", add: "+ Add group", group: "Group", type: "Technology", duplicate: "Duplicate", remove: "Delete", assumptions: "Assumptions", catalogue: "Catalogue", customer: "Customer", admin: "Admin", importCatalog: "Import catalogue" },
};

const num = (value) => Number(String(value ?? "").replace(",", ".")) || 0;
const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(num(value));
const dec = (value, d = 1) => new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }).format(num(value));

export default function AppV31Complete() {
  const [lang, setLang] = useState("it");
  const [admin, setAdmin] = useState(false);
  const [mode, setMode] = useState("quick");
  const [project, setProject] = useState({ municipality: "", contact: "", country: "Italy" });
  const [products, setProducts] = useState(PRODUCTS);
  const [assumptions, setAssumptions] = useState(ASSUMPTIONS);
  const [groups, setGroups] = useState([createManualGroup(1, { label: "Street lighting", quantity: 500, existingType: "SAP", existingWatt: 100, productId: "street60", smart: true, powerAid: true, hybrid: false })]);
  const auditRef = useRef(null);
  const catalogRef = useRef(null);
  const t = L[lang];
  const calculation = useMemo(() => calculateManualProject(groups, assumptions, products), [groups, assumptions, products]);

  const updateGroup = (id, key, value) => setGroups((current) => current.map((g) => g.id === id ? { ...g, [key]: value } : g));
  const addGroup = (source) => setGroups((current) => [...current, createManualGroup(current.length + 1, source || { productId: products[0]?.id || "" })]);

  async function importAudit(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const normalized = rows.map((row, index) => ({
      label: row.Group || row.group || row.Name || row.name || row.ID || `Group ${index + 1}`,
      quantity: num(row.Quantity || row.quantity || row.Qty || row.qty || 1),
      existingType: row.Existing_Type || row.existingType || row.Type || row.type || "Unknown",
      existingWatt: num(row.Existing_Watt || row.existingWatt || row.Watt || row.watt || row.Power || row.power),
    })).filter((row) => row.existingWatt > 0);
    if (normalized.length) setGroups(normalized.map((row, index) => createManualGroup(index + 1, { ...row, productId: products[0]?.id || "", smart: true, powerAid: false, hybrid: false })));
    setMode("manual"); event.target.value = "";
  }

  async function importCatalogue(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const imported = rows.map((row, index) => ({ id: `p-${Date.now()}-${index}`, name: String(row.Name || row.name || row.Product || row.product || `Product ${index + 1}`), watt: num(row.Watt || row.watt), lumen: num(row.Lumen || row.lumen), sellPrice: num(row.Sell || row.sellPrice || row.Price || row.price), buyPrice: num(row.Buy || row.buyPrice || row.Cost || row.cost), install: num(row.Install || row.install) })).filter((p) => p.watt > 0);
    if (imported.length) { setProducts(imported); setGroups((current) => current.map((g) => ({ ...g, productId: imported[0].id }))); }
    event.target.value = "";
  }

  const first = groups[0];
  return <div style={s.page}>
    <header style={s.header}><div><h1 style={s.title}>{t.title}</h1><div style={s.muted}>{t.sub}</div></div><div style={s.actions}><button className="v31-button" onClick={() => setAdmin(false)}>{t.customer}</button><button className="v31-button" onClick={() => setAdmin(true)}>{t.admin}</button><button className="v31-button" onClick={() => setLang(lang === "it" ? "en" : "it")}>{lang === "it" ? "EN" : "IT"}</button></div></header>

    <nav style={s.nav}>{[["quick", t.quick], ["manual", t.manual], ["audit", t.audit]].map(([id, label]) => <button key={id} style={mode === id ? s.activeTab : s.tab} onClick={() => { setMode(id); if (id === "audit") auditRef.current?.click(); }}>{label}</button>)}</nav>
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

    <section style={s.card}><h2>{t.project}</h2><div style={s.formGrid}><Field label={t.municipality} value={project.municipality} onChange={(v) => setProject((p) => ({ ...p, municipality: v }))} /><Field label={t.contact} value={project.contact} onChange={(v) => setProject((p) => ({ ...p, contact: v }))} /><Field label="Country" value={project.country} onChange={(v) => setProject((p) => ({ ...p, country: v }))} /></div></section>

    {mode === "quick" && first && <section style={s.card}><h2>{t.quick}</h2><div style={s.formGrid}><Field numeric label={t.qty} value={first.quantity} onChange={(v) => updateGroup(first.id, "quantity", num(v))} /><Field numeric label={t.watt} value={first.existingWatt} onChange={(v) => updateGroup(first.id, "existingWatt", num(v))} /><Select label={t.product} value={first.productId} onChange={(v) => updateGroup(first.id, "productId", v)} options={products.map((p) => ({ value: p.id, label: `${p.name} · ${p.watt}W` }))} /><Toggle label={t.smart} checked={first.smart} onChange={(v) => updateGroup(first.id, "smart", v)} /><Toggle label={t.power} checked={first.powerAid} disabled={!first.smart} onChange={(v) => updateGroup(first.id, "powerAid", v)} /><Toggle label={t.hybrid} checked={first.hybrid} onChange={(v) => updateGroup(first.id, "hybrid", v)} /></div></section>}

    {mode === "manual" && <section style={s.card}><div style={s.sectionHead}><h2>{t.manual}</h2><button onClick={() => addGroup()}>{t.add}</button></div><div style={s.tableWrap}><table style={s.table}><thead><tr><th>{t.group}</th><th>{t.qty}</th><th>{t.type}</th><th>{t.watt}</th><th>{t.product}</th><th>{t.smart}</th><th>{t.power}</th><th>{t.hybrid}</th><th /></tr></thead><tbody>{groups.map((g) => <tr key={g.id}><td><input value={g.label} onChange={(e) => updateGroup(g.id, "label", e.target.value)} /></td><td><input value={g.quantity} onChange={(e) => updateGroup(g.id, "quantity", num(e.target.value))} /></td><td><input value={g.existingType} onChange={(e) => updateGroup(g.id, "existingType", e.target.value)} /></td><td><input value={g.existingWatt} onChange={(e) => updateGroup(g.id, "existingWatt", num(e.target.value))} /></td><td><select value={g.productId} onChange={(e) => updateGroup(g.id, "productId", e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td><td><input type="checkbox" checked={g.smart} onChange={(e) => updateGroup(g.id, "smart", e.target.checked)} /></td><td><input type="checkbox" checked={g.powerAid} disabled={!g.smart} onChange={(e) => updateGroup(g.id, "powerAid", e.target.checked)} /></td><td><input type="checkbox" checked={g.hybrid} onChange={(e) => updateGroup(g.id, "hybrid", e.target.checked)} /></td><td><button onClick={() => { const { id, ...copy } = g; addGroup({ ...copy, label: `${g.label} copy` }); }}>{t.duplicate}</button><button onClick={() => setGroups((current) => current.length > 1 ? current.filter((x) => x.id !== g.id) : current)}>{t.remove}</button></td></tr>)}</tbody></table></div></section>}

    {admin && <section style={s.adminGrid}><div style={s.card}><h2>{t.assumptions}</h2><div style={s.formGrid}>{Object.entries(assumptions).map(([key, value]) => <Field key={key} numeric label={key} value={value} onChange={(v) => setAssumptions((a) => ({ ...a, [key]: num(v) }))} />)}</div></div><div style={s.card}><div style={s.sectionHead}><h2>{t.catalogue}</h2><button onClick={() => catalogRef.current?.click()}>{t.importCatalog}</button></div>{products.map((p, index) => <div style={s.productRow} key={p.id}><input value={p.name} onChange={(e) => setProducts((current) => current.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} />{["watt", "lumen", "sellPrice", "buyPrice", "install"].map((key) => <input key={key} value={p[key]} onChange={(e) => setProducts((current) => current.map((x, i) => i === index ? { ...x, [key]: num(e.target.value) } : x))} />)}</div>)}</div></section>}
  </div>;
}

function Kpi({ label, value }) { return <div style={s.kpi}><span>{label}</span><strong>{value}</strong></div>; }
function Field({ label, value, onChange, numeric }) { return <label style={s.field}><span>{label}</span><input inputMode={numeric ? "decimal" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label style={s.field}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }
function Toggle({ label, checked, onChange, disabled }) { return <label style={s.toggle}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /></label>; }

const s = {
  page: { minHeight: "100vh", padding: 24, background: "#f4f7fb", color: "#0f172a", fontFamily: "Inter,Arial,sans-serif" },
  header: { background: "white", border: "1px solid #dce4ef", borderRadius: 24, padding: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }, title: { margin: 0 }, muted: { color: "#64748b" }, actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  nav: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 16 }, tab: { padding: 15, borderRadius: 14, border: "1px solid #cbd5e1", background: "white" }, activeTab: { padding: 15, borderRadius: 14, border: "2px solid #2563eb", background: "#eff6ff", fontWeight: 800 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginBottom: 16 }, kpi: { background: "white", border: "1px solid #dce4ef", borderRadius: 16, padding: 15, display: "flex", flexDirection: "column", gap: 7 },
  card: { background: "white", border: "1px solid #dce4ef", borderRadius: 20, padding: 18, marginBottom: 16 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }, field: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700 }, toggle: { border: "1px solid #dce4ef", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between" },
  sectionHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }, tableWrap: { overflowX: "auto" }, table: { width: "100%", minWidth: 1100, borderCollapse: "collapse" }, adminGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }, productRow: { display: "grid", gridTemplateColumns: "2fr repeat(5,1fr)", gap: 6, marginBottom: 8, overflowX: "auto" },
};
