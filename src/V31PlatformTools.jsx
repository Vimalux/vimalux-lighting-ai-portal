import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const STORAGE_KEY = "vimalux-v31-projects";

function n(value) { return Number(value) || 0; }
function money(value) { return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n(value)); }
function dec(value, digits = 1) { return new Intl.NumberFormat("it-IT", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n(value)); }

function readProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function writeProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function normalizeCoordinateRows(rows) {
  const keys = {
    lat: ["lat", "latitude", "y", "gps_lat", "geo_lat"],
    lon: ["lon", "lng", "longitude", "x", "gps_lon", "geo_lon"],
    id: ["id", "pole_id", "luminaire_id", "code", "codice", "punto_luce"],
    cabinet: ["cabinet", "quadro", "panel", "control_panel"],
    watt: ["watt", "wattage", "power", "potenza"],
    type: ["type", "lamp_type", "luminaire_type", "tipo"],
  };
  const pick = (row, aliases) => {
    const entry = Object.entries(row).find(([key]) => aliases.includes(String(key).trim().toLowerCase()));
    return entry?.[1];
  };
  return rows.map((row, index) => ({
    id: String(pick(row, keys.id) || `PL-${index + 1}`),
    lat: n(String(pick(row, keys.lat) || "").replace(",", ".")),
    lon: n(String(pick(row, keys.lon) || "").replace(",", ".")),
    cabinet: String(pick(row, keys.cabinet) || ""),
    watt: n(pick(row, keys.watt)),
    type: String(pick(row, keys.type) || ""),
  })).filter((point) => point.lat >= -90 && point.lat <= 90 && point.lon >= -180 && point.lon <= 180 && (point.lat !== 0 || point.lon !== 0));
}

export default function V31PlatformTools({ lang, project, setProject, groups, setGroups, assumptions, setAssumptions, products, setProducts, calculation }) {
  const [projects, setProjects] = useState(() => readProjects());
  const [gisPoints, setGisPoints] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const gisInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const it = lang === "it";

  const selected = projects.find((item) => item.id === selectedId);
  const mapBounds = useMemo(() => {
    if (!gisPoints.length) return null;
    const lats = gisPoints.map((p) => p.lat);
    const lons = gisPoints.map((p) => p.lon);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
  }, [gisPoints]);

  function flash(text) { setMessage(text); window.setTimeout(() => setMessage(""), 2500); }

  function saveProject() {
    const id = selectedId || `project-${Date.now()}`;
    const record = { id, name: project.municipality || (it ? "Nuovo progetto" : "New project"), updatedAt: new Date().toISOString(), project, groups, assumptions, products, gisPoints };
    const next = [record, ...projects.filter((item) => item.id !== id)];
    setProjects(next); writeProjects(next); setSelectedId(id); flash(it ? "Progetto salvato" : "Project saved");
  }

  function loadProject() {
    if (!selected) return;
    setProject(selected.project || {}); setGroups(selected.groups || []); setAssumptions(selected.assumptions || {}); setProducts(selected.products || []); setGisPoints(selected.gisPoints || []);
    flash(it ? "Progetto aperto" : "Project loaded");
  }

  function deleteProject() {
    if (!selectedId) return;
    const next = projects.filter((item) => item.id !== selectedId);
    setProjects(next); writeProjects(next); setSelectedId(""); flash(it ? "Progetto eliminato" : "Project deleted");
  }

  function exportProject() {
    const payload = { version: 31, exportedAt: new Date().toISOString(), project, groups, assumptions, products, gisPoints };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${project.municipality || "vimalux-project"}.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function importProject(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      setProject(data.project || {}); setGroups(data.groups || []); setAssumptions(data.assumptions || {}); setProducts(data.products || []); setGisPoints(data.gisPoints || []); flash(it ? "Progetto importato" : "Project imported");
    } catch { flash(it ? "File progetto non valido" : "Invalid project file"); }
    event.target.value = "";
  }

  async function importGis(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      let rows = [];
      if (file.name.toLowerCase().endsWith(".json")) {
        const raw = JSON.parse(await file.text());
        if (Array.isArray(raw)) rows = raw;
        else if (Array.isArray(raw.features)) rows = raw.features.map((f) => ({ ...f.properties, lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] }));
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      }
      const points = normalizeCoordinateRows(rows);
      if (!points.length) throw new Error("no coordinates");
      setGisPoints(points); flash(`${points.length} ${it ? "punti GIS importati" : "GIS points imported"}`);
    } catch { flash(it ? "Coordinate GIS non riconosciute" : "GIS coordinates not recognized"); }
    event.target.value = "";
  }

  function exportExcel() {
    const groupRows = groups.map((group, index) => ({ Group: group.label, Quantity: group.quantity, Existing_Type: group.existingType, Existing_Watt: group.existingWatt, Product: products.find((p) => p.id === group.productId)?.name || group.productId, Smart: group.smart, PowerAiD: group.powerAid, Hybrid: group.hybrid, CAPEX: calculation.groups[index]?.totalCapex, Annual_Net_Saving: calculation.groups[index]?.annualNetSaving }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groupRows), "Project_Groups");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(gisPoints), "GIS_Points");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(calculation.finance.yearly), "Cash_Flow");
    XLSX.writeFile(workbook, `${project.municipality || "VIMALUX"}_V31.xlsx`);
  }

  function generatePdf() {
    const doc = new jsPDF();
    const title = project.municipality || "VIMALUX Smart Lighting Project";
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 42, "F"); doc.setTextColor(255); doc.setFontSize(22); doc.text("VIMALUX", 15, 18); doc.setFontSize(13); doc.text(title, 15, 30);
    doc.setTextColor(15, 23, 42); doc.setFontSize(16); doc.text(it ? "Executive Summary" : "Executive Summary", 15, 55);
    const t = calculation.totals; const f = calculation.finance;
    autoTable(doc, { startY: 62, theme: "grid", head: [["KPI", "Value"]], body: [
      ["Luminaires", dec(t.quantity, 0)], ["CAPEX", money(t.totalCapex)], ["Annual net saving", money(t.annualNetSaving)], ["Payback", t.payback ? `${dec(t.payback)} years` : "-"], ["Energy reduction", `${dec(t.energyReductionPct)}%`], ["NPV", money(f.npv)], ["IRR", f.irr === null ? "-" : `${dec(f.irr)}%`], ["ROI", `${dec(f.roiPct)}%`], ["Annual CO2 avoided", `${dec(f.annualCo2Tonnes)} t`]
    ] });
    doc.addPage(); doc.setFontSize(16); doc.text("Solution and Energy Analysis", 15, 18);
    autoTable(doc, { startY: 25, theme: "striped", head: [["Group", "Qty", "Existing", "Product", "Smart", "PowerAiD", "Hybrid"]], body: groups.map((g) => [g.label, g.quantity, `${g.existingType} ${g.existingWatt}W`, products.find((p) => p.id === g.productId)?.name || "-", g.smart ? "Yes" : "No", g.powerAid ? "Yes" : "No", g.hybrid ? "Yes" : "No"]) });
    doc.addPage(); doc.setFontSize(16); doc.text("Financial Cash Flow", 15, 18);
    autoTable(doc, { startY: 25, theme: "grid", head: [["Year", "Net saving", "Cumulative"]], body: f.yearly.map((row) => [row.year, money(row.netSaving), money(row.cumulative)]) });
    if (gisPoints.length) { doc.addPage(); doc.setFontSize(16); doc.text("GIS Overview", 15, 18); doc.setFontSize(11); doc.text(`${gisPoints.length} lighting points imported`, 15, 27); autoTable(doc, { startY: 34, head: [["ID", "Latitude", "Longitude", "Cabinet", "Watt"]], body: gisPoints.slice(0, 100).map((p) => [p.id, p.lat, p.lon, p.cabinet, p.watt]) }); }
    doc.save(`${project.municipality || "VIMALUX"}_Smart_Lighting_Proposal.pdf`);
  }

  return <section style={styles.wrapper}>
    {message && <div style={styles.message}>{message}</div>}
    <div style={styles.header}><div><h2 style={styles.h2}>{it ? "Piattaforma progetto" : "Project platform"}</h2><div style={styles.muted}>{it ? "Salvataggio, report, Excel e GIS" : "Storage, reporting, Excel and GIS"}</div></div>
      <div style={styles.actions}><button onClick={saveProject}>Save</button><button onClick={generatePdf}>PDF</button><button onClick={exportExcel}>Excel</button><button onClick={exportProject}>JSON</button><button onClick={() => fileInputRef.current?.click()}>Import</button></div>
    </div>
    <input ref={fileInputRef} type="file" accept=".json" hidden onChange={importProject} />
    <input ref={gisInputRef} type="file" accept=".xlsx,.xls,.csv,.json,.geojson" hidden onChange={importGis} />
    <div style={styles.grid}>
      <div style={styles.panel}><h3>{it ? "Progetti salvati" : "Saved projects"}</h3><select style={styles.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}><option value="">—</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name} · {new Date(item.updatedAt).toLocaleDateString()}</option>)}</select><div style={styles.smallActions}><button disabled={!selected} onClick={loadProject}>Open</button><button disabled={!selected} onClick={deleteProject}>Delete</button></div></div>
      <div style={styles.panel}><div style={styles.header}><h3>GIS</h3><button onClick={() => gisInputRef.current?.click()}>{it ? "Importa coordinate" : "Import coordinates"}</button></div><div style={styles.map}>{mapBounds ? gisPoints.slice(0, 1500).map((p) => { const x = ((p.lon - mapBounds.minLon) / Math.max(0.000001, mapBounds.maxLon - mapBounds.minLon)) * 94 + 3; const y = 97 - ((p.lat - mapBounds.minLat) / Math.max(0.000001, mapBounds.maxLat - mapBounds.minLat)) * 94; return <span key={p.id} title={`${p.id} · ${p.watt}W`} style={{ ...styles.point, left: `${x}%`, top: `${y}%` }} />; }) : <div style={styles.mapEmpty}>{it ? "Importa latitudine e longitudine" : "Import latitude and longitude"}</div>}</div><div style={styles.muted}>{gisPoints.length} points</div></div>
    </div>
  </section>;
}

const styles = {
  wrapper: { background: "white", border: "1px solid #dce4ef", borderRadius: 22, padding: 20, marginBottom: 18, position: "relative" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }, h2: { margin: 0 }, muted: { color: "#64748b", fontSize: 12 },
  actions: { display: "flex", gap: 7, flexWrap: "wrap" }, smallActions: { display: "flex", gap: 8, marginTop: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginTop: 16 }, panel: { border: "1px solid #e2e8f0", borderRadius: 16, padding: 14 },
  select: { width: "100%", padding: 10, borderRadius: 10, border: "1px solid #cbd5e1" },
  map: { height: 260, background: "linear-gradient(135deg,#e2e8f0,#f8fafc)", border: "1px solid #cbd5e1", borderRadius: 14, position: "relative", overflow: "hidden", margin: "10px 0" },
  point: { position: "absolute", width: 7, height: 7, borderRadius: 999, background: "#2563eb", transform: "translate(-50%,-50%)", boxShadow: "0 0 0 2px rgba(255,255,255,.7)" }, mapEmpty: { display: "grid", placeItems: "center", height: "100%", color: "#64748b" },
  message: { position: "absolute", right: 20, top: -12, background: "#0f172a", color: "white", borderRadius: 10, padding: "9px 12px", fontWeight: 700 },
};
