import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const productsDefault = [
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 10200, sellPrice: 155, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 15300, sellPrice: 210, buyPrice: 150, install: 40 },
];

const assumptionsDefault = {
  ledSavingPct: 55,
  energyPrice: 0.29,
  burningHours: 4200,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  cloSavingPct: 10,
  powerAidAdditionalSavingPct: 35,
  proposalYears: 10,
  discountRatePct: 7,
  serviceEfficiencyPerLampYear: 10,
  fewerFailuresPerLampYear: 6,
  adminReductionPerLampYear: 4,
};

const offers = [
  { id: "led", title: "LED Only", smart: false, powerAid: false, badge: "Base" },
  { id: "smart", title: "Smart CMS", smart: true, powerAid: false, badge: "Recommended" },
  { id: "premium", title: "Smart + PowerAiD", smart: true, powerAid: true, badge: "Premium" },
];

function n(v) {
  if (v === "" || v == null) return 0;
  return Number(String(v).replace(",", ".")) || 0;
}

function euro(v) {
  return `€${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(n(v))}`;
}

function dec(v, d = 1) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n(v));
}

function calcCase(project, a, product, offer) {
  const qty = n(project.quantity);
  const oldWatt = n(project.existingWatt);
  const oldKwh = (qty * oldWatt * n(a.burningHours)) / 1000;
  const oldEnergyCost = oldKwh * n(a.energyPrice);

  const ledSaving = oldEnergyCost * (n(a.ledSavingPct) / 100);
  const postLed = oldEnergyCost - ledSaving;

  const cloSaving = offer.smart ? postLed * (n(a.cloSavingPct) / 100) : 0;
  const postClo = postLed - cloSaving;

  const powerAidSaving = offer.powerAid ? postClo * (n(a.powerAidAdditionalSavingPct) / 100) : 0;

  const maintenanceSaving = offer.smart
    ? qty * n(a.maintenanceOldPerLamp) * (n(a.maintenanceSavingPct) / 100)
    : 0;

  const guaranteedSaving = ledSaving + cloSaving + powerAidSaving + maintenanceSaving;

  const opex =
    (offer.smart ? qty * n(a.cmsFeePerLampYear) : 0) +
    (offer.powerAid ? qty * n(a.powerAidFeePerLampYear) : 0);

  const operationalUpside = offer.smart
    ? qty * (n(a.serviceEfficiencyPerLampYear) + n(a.fewerFailuresPerLampYear) + n(a.adminReductionPerLampYear))
    : 0;

  const capex =
    qty * n(product.sellPrice) +
    (project.includeInstallation ? qty * n(product.install) : 0) +
    (offer.smart ? qty * n(a.smartNodeCost) : 0);

  const baseNet = guaranteedSaving - opex;
  const upsideNet = baseNet + operationalUpside;

  const years = n(a.proposalYears) || 10;

  return {
    ...offer,
    capex,
    ledSaving,
    cloSaving,
    powerAidSaving,
    maintenanceSaving,
    guaranteedSaving,
    opex,
    operationalUpside,
    baseNet,
    upsideNet,
    basePayback: baseNet > 0 ? capex / baseNet : 0,
    upsidePayback: upsideNet > 0 ? capex / upsideNet : 0,
    base10Y: baseNet * years,
    upside10Y: upsideNet * years,
    energyReductionPct: oldEnergyCost ? ((ledSaving + cloSaving + powerAidSaving) / oldEnergyCost) * 100 : 0,
  };
}

export default function App() {
  const [products, setProducts] = useState(productsDefault);
  const [assumptions, setAssumptions] = useState(assumptionsDefault);
  const [project, setProject] = useState({
    customer: "",
    municipality: "",
    quantity: 500,
    existingWatt: 100,
    selectedProductId: "street60",
    selectedOffer: "premium",
    includeInstallation: true,
  });
  const [audit, setAudit] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [toast, setToast] = useState("");

  const product = products.find((p) => p.id === project.selectedProductId) || products[0];

  const cases = useMemo(
    () => offers.map((o) => calcCase(project, assumptions, product, o)),
    [project, assumptions, product]
  );

  const selected = cases.find((c) => c.id === project.selectedOffer) || cases[0];

  function updateProject(key, value) {
    setProject((p) => ({ ...p, [key]: value }));
  }

  function updateAssumption(key, value) {
    setAssumptions((p) => ({ ...p, [key]: value }));
  }

  async function importAudit(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      let totalQty = 0;
      let totalWatt = 0;
      let rows = 0;

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }).slice(0, 29);

        raw.forEach((row) => {
          const qty = n(row[3]);   // Column D
          const watt = n(row[6]);  // Column G

          if (qty > 0 && watt > 0) {
            totalQty += qty;
            totalWatt += qty * watt;
            rows += 1;
          }
        });
      });

      if (!totalQty || !totalWatt) throw new Error("No valid audit rows");

      const avg = totalWatt / totalQty;

      setAudit({
        fileName: file.name,
        rows,
        quantity: totalQty,
        averageWatt: avg,
      });

      setProject((p) => ({
        ...p,
        quantity: Math.round(totalQty),
        existingWatt: Number(avg.toFixed(1)),
      }));

      setToast(`Audit imported: ${Math.round(totalQty)} luminaires / ${avg.toFixed(1)} W`);
    } catch (err) {
      console.error(err);
      setToast("Audit import failed");
    }

    e.target.value = "";
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("VIMALUX Smart Lighting Proposal", 14, 20);

    autoTable(doc, {
      startY: 35,
      head: [["Metric", "Value"]],
      body: [
        ["Selected package", selected.title],
        ["Quantity", project.quantity],
        ["Existing wattage", `${project.existingWatt} W`],
        ["Base annual net saving", euro(selected.baseNet)],
        ["Base payback", `${dec(selected.basePayback)} years`],
        ["Upside annual net saving", euro(selected.upsideNet)],
        ["Upside payback", `${dec(selected.upsidePayback)} years`],
        ["10Y base net", euro(selected.base10Y)],
        ["10Y upside net", euro(selected.upside10Y)],
      ],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Layer", "Annual value"]],
      body: [
        ["LED saving", euro(selected.ledSaving)],
        ["CLO saving", euro(selected.cloSaving)],
        ["Maintenance saving", euro(selected.maintenanceSaving)],
        ["PowerAiD saving", euro(selected.powerAidSaving)],
        ["OPEX", `-${euro(selected.opex)}`],
        ["Operational upside", euro(selected.operationalUpside)],
      ],
    });

    doc.save("VIMALUX_V27_Proposal.pdf");
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cases), "Cases");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([project]), "Project");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([assumptions]), "Assumptions");
    if (audit) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([audit]), "Audit");
    XLSX.writeFile(wb, "VIMALUX_V27.xlsx");
  }

  return (
    <div style={s.page}>
      {toast && <div style={toast.includes("failed") ? s.toastErr : s.toast}>{toast}</div>}

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>VIMALUX Lighting AI Portal</h1>
          <p style={s.sub}>Version 27 – Clean Audit + ROI Engine</p>
        </div>
        <div style={s.row}>
          <button style={s.btnDark}>Customer</button>
          <button style={s.btn} onClick={() => setAdmin(!admin)}>Admin</button>
          <button style={s.btnDark} onClick={exportPdf}>PDF Proposal</button>
          <button style={s.btn} onClick={exportExcel}>Excel</button>
        </div>
      </div>

      <div style={s.cards3}>
        {cases.map((c) => (
          <button
            key={c.id}
            onClick={() => updateProject("selectedOffer", c.id)}
            style={project.selectedOffer === c.id ? s.offerSel : s.offer}
          >
            <div style={s.offerTop}>
              <h2>{c.title}</h2>
              <span style={s.badge}>{c.badge}</span>
            </div>
            <div style={s.metricRow}>
              <span>Base Payback<br /><b>{dec(c.basePayback)} yrs</b></span>
              <span>Upside Payback<br /><b>{dec(c.upsidePayback)} yrs</b></span>
            </div>
            <p style={s.green}>Base 10Y: {euro(c.base10Y)} · Upside: {euro(c.operationalUpside)} / year</p>
          </button>
        ))}
      </div>

      <div style={s.auditBox}>
        <div>
          <b>Audit import</b><br />
          {audit
            ? `${audit.fileName}: ${Math.round(audit.quantity)} luminaires · ${audit.averageWatt.toFixed(1)} W avg`
            : "Upload VIMALUX audit sheet. Reads only rows 1–29, column D quantity, column G watt."}
        </div>
        <label style={s.greenBtn}>
          Import Audit Sheet
          <input type="file" accept=".xlsx,.xls,.csv" onChange={importAudit} style={{ display: "none" }} />
        </label>
      </div>

      <div style={s.kpis}>
        <Kpi label="Base Annual Net" value={euro(selected.baseNet)} />
        <Kpi label="Upside Annual Net" value={euro(selected.upsideNet)} />
        <Kpi label="Base Payback" value={`${dec(selected.basePayback)} yrs`} />
        <Kpi label="Upside Payback" value={`${dec(selected.upsidePayback)} yrs`} />
        <Kpi label="CAPEX" value={euro(selected.capex)} />
        <Kpi label="Energy Reduction" value={`${dec(selected.energyReductionPct)}%`} />
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <h2>Project Input</h2>
          <div style={s.formGrid}>
            <Input label="Customer" value={project.customer} onChange={(v) => updateProject("customer", v)} />
            <Input label="Municipality" value={project.municipality} onChange={(v) => updateProject("municipality", v)} />
            <Input label="Quantity" value={project.quantity} onChange={(v) => updateProject("quantity", n(v))} />
            <Input label="Existing wattage" value={project.existingWatt} onChange={(v) => updateProject("existingWatt", n(v))} />
            <label>
              Product
              <select style={s.input} value={project.selectedProductId} onChange={(e) => updateProject("selectedProductId", e.target.value)}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} – {p.watt}W – {euro(p.sellPrice)}</option>)}
              </select>
            </label>
            <label style={s.check}>
              Installation included
              <input type="checkbox" checked={project.includeInstallation} onChange={(e) => updateProject("includeInstallation", e.target.checked)} />
            </label>
          </div>
        </div>

        <div style={s.card}>
          <h2>Value Stack</h2>
          <Bar label="LED saving" value={selected.ledSaving} max={selected.guaranteedSaving} />
          <Bar label="CLO saving" value={selected.cloSaving} max={selected.guaranteedSaving} />
          <Bar label="Maintenance saving" value={selected.maintenanceSaving} max={selected.guaranteedSaving} />
          <Bar label="PowerAiD saving" value={selected.powerAidSaving} max={selected.guaranteedSaving} />
          <Bar label="OPEX" value={-selected.opex} max={selected.guaranteedSaving} red />
          <Bar label="Operational upside" value={selected.operationalUpside} max={selected.operationalUpside || 1} green />
        </div>
      </div>

      {admin && (
        <div style={s.grid2}>
          <div style={s.card}>
            <h2>Admin Assumptions</h2>
            <div style={s.formGrid}>
              {Object.entries(assumptions).map(([k, v]) => (
                <Input key={k} label={k} value={v} onChange={(x) => updateAssumption(k, x)} />
              ))}
            </div>
          </div>

          <div style={s.card}>
            <h2>Product Override</h2>
            {products.map((p, i) => (
              <div key={p.id} style={s.productRow}>
                <input style={s.input} value={p.name} onChange={(e) => {
                  const next = [...products];
                  next[i].name = e.target.value;
                  setProducts(next);
                }} />
                <input style={s.smallInput} value={p.watt} onChange={(e) => {
                  const next = [...products];
                  next[i].watt = n(e.target.value);
                  setProducts(next);
                }} />
                <input style={s.smallInput} value={p.sellPrice} onChange={(e) => {
                  const next = [...products];
                  next[i].sellPrice = n(e.target.value);
                  setProducts(next);
                }} />
                <input style={s.smallInput} value={p.install} onChange={(e) => {
                  const next = [...products];
                  next[i].install = n(e.target.value);
                  setProducts(next);
                }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return <div style={s.kpi}><p>{label}</p><h2>{value}</h2></div>;
}

function Input({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input style={s.input} value={String(value).replace(".", ",")} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Bar({ label, value, max, red, green }) {
  const w = Math.min(100, Math.abs(n(value)) / Math.max(1, n(max)) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={s.barTop}><b>{label}</b><b>{value < 0 ? "-" : ""}{euro(Math.abs(value))}</b></div>
      <div style={s.track}><div style={{ ...s.fill, width: `${Math.max(3, w)}%`, background: red ? "#ef4444" : green ? "#22c55e" : "#2563eb" }} /></div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f5f7fb", padding: 28, fontFamily: "Inter, Arial, sans-serif", color: "#0f172a" },
  header: { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 24, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  h1: { margin: 0, fontSize: 32 },
  sub: { margin: "6px 0 0", color: "#64748b" },
  row: { display: "flex", gap: 10 },
  btn: { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 14, padding: "12px 18px", fontWeight: 800 },
  btnDark: { border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 14, padding: "12px 18px", fontWeight: 800 },
  cards3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  offer: { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 22, padding: 18, textAlign: "left" },
  offerSel: { background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 22, padding: 17, textAlign: "left" },
  offerTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  badge: { background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontWeight: 800 },
  metricRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 },
  green: { color: "#059669", fontWeight: 900 },
  auditBox: { background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 22, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greenBtn: { background: "#16a34a", color: "#fff", borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  kpi: { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 22, padding: 18 },
  grid2: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 24 },
  card: { background: "#fff", border: "1px solid #dbe3ee", borderRadius: 22, padding: 22 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px", marginTop: 6 },
  smallInput: { width: 90, border: "1px solid #cbd5e1", borderRadius: 12, padding: "10px" },
  check: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 14, padding: 12 },
  barTop: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  track: { height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  productRow: { display: "grid", gridTemplateColumns: "1fr 90px 90px 90px", gap: 10, marginBottom: 10 },
  toast: { position: "fixed", right: 20, top: 20, background: "#16a34a", color: "#fff", padding: "14px 18px", borderRadius: 14, fontWeight: 900, zIndex: 10 },
  toastErr: { position: "fixed", right: 20, top: 20, background: "#dc2626", color: "#fff", padding: "14px 18px", borderRadius: 14, fontWeight: 900, zIndex: 10 },
};
