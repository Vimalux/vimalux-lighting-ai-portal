import React, { useMemo, useState } from "react";

const products = [
  { id: "street60", name: "VIMALUX Street Pro 60W Smart", watt: 60, price: 150, install: 45, type: "Street / Urban", tags: "Zhaga, D4i, CMS" },
  { id: "urban45", name: "VIMALUX Urban 45W Smart", watt: 45, price: 135, install: 45, type: "Urban Roads", tags: "Zhaga, D4i, CMS" },
  { id: "decor35", name: "VIMALUX Decorative Retrofit 35W Smart", watt: 35, price: 120, install: 50, type: "Decorative", tags: "Retrofit, CMS" },
  { id: "main90", name: "VIMALUX Main Road 90W Smart", watt: 90, price: 185, install: 50, type: "Main Roads", tags: "Zhaga, D4i, Traffic" }
];

const initialRows = [
  { id: 1, area: "Main roads", oldType: "HPS 150W", oldWatt: 150, qty: 320, hours: 4200, productId: "street60" },
  { id: 2, area: "Urban roads", oldType: "HPS 100W", oldWatt: 100, qty: 410, hours: 4200, productId: "urban45" },
  { id: 3, area: "Historic centre", oldType: "Decorative 70W", oldWatt: 70, qty: 180, hours: 4200, productId: "decor35" }
];

function eur(v) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function num(v) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(v || 0);
}

function recommend(watt) {
  if (watt >= 180) return "main90";
  if (watt >= 120) return "street60";
  if (watt >= 80) return "urban45";
  return "decor35";
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [rows, setRows] = useState(initialRows);
  const [lead, setLead] = useState({ company: "", email: "", country: "Italy", lamps: "" });
  const [params, setParams] = useState({
    energyPrice: 0.27,
    smartSaving: 22,
    maintenanceCost: 25,
    maintenanceReduction: 75,
    software: 6,
    powerAid: 3,
    years: 15,
    investorMultiple: 8
  });

  const calculated = useMemo(() => {
    return rows.map((row) => {
      const product = products.find((p) => p.id === row.productId) || products[0];
      const beforeKwh = (row.oldWatt * row.qty * row.hours) / 1000;
      const ledKwh = (product.watt * row.qty * row.hours) / 1000;
      const afterKwh = ledKwh * (1 - params.smartSaving / 100);
      const energySaving = (beforeKwh - afterKwh) * params.energyPrice;
      const maintenanceSaving = row.qty * params.maintenanceCost * (params.maintenanceReduction / 100);
      const opex = row.qty * (params.software + params.powerAid);
      const netSaving = energySaving + maintenanceSaving - opex;
      const capex = row.qty * (product.price + product.install);
      const payback = netSaving > 0 ? capex / netSaving : 0;
      const co2 = (beforeKwh - afterKwh) * 0.35;
      return { ...row, product, beforeKwh, afterKwh, energySaving, maintenanceSaving, opex, netSaving, capex, payback, co2 };
    });
  }, [rows, params]);

  const totals = useMemo(() => {
    const t = calculated.reduce(
      (a, r) => {
        a.qty += r.qty;
        a.beforeKwh += r.beforeKwh;
        a.afterKwh += r.afterKwh;
        a.energySaving += r.energySaving;
        a.maintenanceSaving += r.maintenanceSaving;
        a.opex += r.opex;
        a.netSaving += r.netSaving;
        a.capex += r.capex;
        a.co2 += r.co2;
        return a;
      },
      { qty: 0, beforeKwh: 0, afterKwh: 0, energySaving: 0, maintenanceSaving: 0, opex: 0, netSaving: 0, capex: 0, co2: 0 }
    );

    t.payback = t.netSaving > 0 ? t.capex / t.netSaving : 0;
    t.value15 = t.netSaving * params.years - t.capex;
    t.investorValue = t.netSaving * params.investorMultiple;
    return t;
  }, [calculated, params]);

  function updateRow(id, field, value) {
    setRows((old) =>
      old.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, [field]: value };
        if (field === "oldWatt") next.productId = recommend(Number(value));
        return next;
      })
    );
  }

  function addRow() {
    setRows((old) => [
      ...old,
      {
        id: Date.now(),
        area: "New area",
        oldType: "HPS 150W",
        oldWatt: 150,
        qty: 100,
        hours: 4200,
        productId: "street60"
      }
    ]);
  }

  function exportCsv() {
    const header = "Area,Existing Type,Old Watt,Qty,Recommended Product,Before kWh,After kWh,Net Saving,Payback";
    const body = calculated
      .map((r) =>
        [
          r.area,
          r.oldType,
          r.oldWatt,
          r.qty,
          r.product.name,
          Math.round(r.beforeKwh),
          Math.round(r.afterKwh),
          Math.round(r.netSaving),
          r.payback.toFixed(1)
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vimalux-lighting-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.app}>
      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.logo}>VIMALUX</div>
          <Nav label="Dashboard" page="dashboard" current={page} setPage={setPage} />
          <Nav label="ROI Calculator" page="calculator" current={page} setPage={setPage} />
          <Nav label="Inventory" page="inventory" current={page} setPage={setPage} />
          <Nav label="Catalogue" page="catalogue" current={page} setPage={setPage} />
          <Nav label="Proposal" page="proposal" current={page} setPage={setPage} />
          <Nav label="Investor" page="investor" current={page} setPage={setPage} />
          <Nav label="Leads" page="leads" current={page} setPage={setPage} />
        </aside>

        <main style={styles.main}>
          <section style={styles.hero}>
            <div>
              <div style={styles.eyebrow}>VIMALUX LIGHTING AI PORTAL · VERSION 3</div>
              <h1 style={styles.h1}>Smart LED replacement engine</h1>
              <p style={styles.subtitle}>Clickable ROI tool, product matching, proposal generator and investor dashboard.</p>
            </div>
            <div style={styles.heroActions}>
              <button style={styles.whiteBtn} onClick={() => setPage("calculator")}>Open calculator</button>
              <button style={styles.whiteBtn} onClick={() => window.print()}>Print / PDF</button>
            </div>
          </section>

          <section style={styles.kpiGrid}>
            <Kpi title="Total lamps" value={num(totals.qty)} onClick={() => setPage("inventory")} />
            <Kpi title="Estimated CAPEX" value={eur(totals.capex)} onClick={() => setPage("calculator")} />
            <Kpi title="Annual net saving" value={eur(totals.netSaving)} onClick={() => setPage("calculator")} />
            <Kpi title="Simple payback" value={`${totals.payback.toFixed(1)} years`} onClick={() => setPage("proposal")} />
            <Kpi title="15Y net value" value={eur(totals.value15)} onClick={() => setPage("investor")} />
            <Kpi title="CO2 saving/year" value={`${num(totals.co2 / 1000)} t`} onClick={() => setPage("proposal")} />
          </section>

          {page === "dashboard" && (
            <section style={styles.grid2}>
              <Card title="Energy before vs after">
                <BarChart before={totals.beforeKwh} after={totals.afterKwh} />
              </Card>
              <Card title="Quick actions">
                <div style={styles.actionGrid}>
                  <button style={styles.darkBtn} onClick={() => setPage("inventory")}>Edit inventory</button>
                  <button style={styles.darkBtn} onClick={() => setPage("calculator")}>Change assumptions</button>
                  <button style={styles.darkBtn} onClick={() => setPage("proposal")}>Prepare proposal</button>
                  <button style={styles.darkBtn} onClick={exportCsv}>Export CSV</button>
                </div>
              </Card>
            </section>
          )}

          {page === "calculator" && (
            <Card title="ROI assumptions">
              <div style={styles.formGrid}>
                <Input label="Energy price €/kWh" value={params.energyPrice} step="0.01" onChange={(v) => setParams({ ...params, energyPrice: Number(v) })} />
                <Input label="Smart extra saving %" value={params.smartSaving} step="1" onChange={(v) => setParams({ ...params, smartSaving: Number(v) })} />
                <Input label="Maintenance cost €/lamp/year" value={params.maintenanceCost} step="1" onChange={(v) => setParams({ ...params, maintenanceCost: Number(v) })} />
                <Input label="Maintenance reduction %" value={params.maintenanceReduction} step="1" onChange={(v) => setParams({ ...params, maintenanceReduction: Number(v) })} />
                <Input label="Software €/lamp/year" value={params.software} step="1" onChange={(v) => setParams({ ...params, software: Number(v) })} />
                <Input label="PowerAiD €/lamp/year" value={params.powerAid} step="1" onChange={(v) => setParams({ ...params, powerAid: Number(v) })} />
                <Input label="Analysis years" value={params.years} step="1" onChange={(v) => setParams({ ...params, years: Number(v) })} />
                <Input label="Investor multiple" value={params.investorMultiple} step="0.5" onChange={(v) => setParams({ ...params, investorMultiple: Number(v) })} />
              </div>
            </Card>
          )}

          {page === "inventory" && (
            <Card title="Inventory and automatic replacement matching">
              <div style={{ marginBottom: 16 }}>
                <button style={styles.darkBtn} onClick={addRow}>Add row</button>
                <button style={{ ...styles.darkBtn, marginLeft: 10 }} onClick={exportCsv}>Export CSV</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {["Area", "Existing type", "Old W", "Qty", "Recommended Smart LED", "Before kWh", "After kWh", "Net saving", "Payback"].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calculated.map((r) => (
                      <tr key={r.id}>
                        <td style={styles.td}><input style={styles.input} value={r.area} onChange={(e) => updateRow(r.id, "area", e.target.value)} /></td>
                        <td style={styles.td}><input style={styles.input} value={r.oldType} onChange={(e) => updateRow(r.id, "oldType", e.target.value)} /></td>
                        <td style={styles.td}><input style={styles.input} type="number" value={r.oldWatt} onChange={(e) => updateRow(r.id, "oldWatt", Number(e.target.value))} /></td>
                        <td style={styles.td}><input style={styles.input} type="number" value={r.qty} onChange={(e) => updateRow(r.id, "qty", Number(e.target.value))} /></td>
                        <td style={styles.td}>
                          <select style={styles.input} value={r.productId} onChange={(e) => updateRow(r.id, "productId", e.target.value)}>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td style={styles.td}>{num(r.beforeKwh)}</td>
                        <td style={styles.td}>{num(r.afterKwh)}</td>
                        <td style={styles.td}><b>{eur(r.netSaving)}</b></td>
                        <td style={styles.td}>{r.payback.toFixed(1)}y</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {page === "catalogue" && (
            <Card title="VIMALUX Smart LED catalogue">
              <div style={styles.productGrid}>
                {products.map((p) => (
                  <div key={p.id} style={styles.productCard}>
                    <h3>{p.name}</h3>
                    <p style={styles.muted}>{p.type}</p>
                    <p><b>{p.watt}W</b> · {p.tags}</p>
                    <p>Unit: <b>{eur(p.price)}</b> · Install: <b>{eur(p.install)}</b></p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {page === "proposal" && (
            <Card title="Proposal summary">
              <p style={styles.largeText}>
                Based on the current inventory, VIMALUX can replace {num(totals.qty)} existing luminaires with Smart LED luminaires equipped with CMS-ready infrastructure.
              </p>
              <div style={styles.kpiGridSmall}>
                <Kpi title="Total investment" value={eur(totals.capex)} />
                <Kpi title="Annual net saving" value={eur(totals.netSaving)} />
                <Kpi title="Payback" value={`${totals.payback.toFixed(1)} years`} />
              </div>
              <button style={styles.darkBtn} onClick={() => window.print()}>Print proposal / PDF</button>
            </Card>
          )}

          {page === "investor" && (
            <Card title="Investor dashboard">
              <div style={styles.kpiGridSmall}>
                <Kpi title="Annual net cashflow" value={eur(totals.netSaving)} />
                <Kpi title="15Y net value" value={eur(totals.value15)} />
                <Kpi title="Portfolio value proxy" value={eur(totals.investorValue)} />
              </div>
              <p style={styles.muted}>
                This is a preliminary investor screening tool. Final values depend on contract duration, municipal credit quality, receivables assignment and technical validation.
              </p>
            </Card>
          )}

          {page === "leads" && (
            <Card title="Lead capture">
              <div style={styles.formGrid}>
                <TextInput label="Company / Municipality" value={lead.company} onChange={(v) => setLead({ ...lead, company: v })} />
                <TextInput label="Email" value={lead.email} onChange={(v) => setLead({ ...lead, email: v })} />
                <TextInput label="Country" value={lead.country} onChange={(v) => setLead({ ...lead, country: v })} />
                <TextInput label="Estimated lamps" value={lead.lamps} onChange={(v) => setLead({ ...lead, lamps: v })} />
              </div>
              <button style={styles.darkBtn} onClick={() => alert("Lead saved in demo. Next step: connect to Airtable / HubSpot.")}>
                Save lead
              </button>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function Nav({ label, page, current, setPage }) {
  return (
    <button
      onClick={() => setPage(page)}
      style={{
        ...styles.nav,
        background: current === page ? "#0f172a" : "transparent",
        color: current === page ? "white" : "#0f172a"
      }}
    >
      {label}
    </button>
  );
}

function Kpi({ title, value, onClick }) {
  return (
    <div style={styles.kpi} onClick={onClick}>
      <div style={styles.kpiTitle}>{title}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section style={styles.card}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, value, step, onChange }) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} type="number" value={value} step={step} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function BarChart({ before, after }) {
  const max = Math.max(before, after, 1);
  return (
    <div>
      <div style={{ height: 260, display: "flex", gap: 30, alignItems: "flex-end", borderBottom: "1px solid #cbd5e1", padding: 20 }}>
        <div style={{ ...styles.bar, height: Math.max(20, (before / max) * 230) }}>{num(before)} kWh</div>
        <div style={{ ...styles.bar, background: "#64748b", height: Math.max(20, (after / max) * 230) }}>{num(after)} kWh</div>
      </div>
      <div style={{ display: "flex", gap: 30, padding: 10, color: "#64748b" }}>
        <div style={{ flex: 1, textAlign: "center" }}>Before</div>
        <div style={{ flex: 1, textAlign: "center" }}>After Smart LED</div>
      </div>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", background: "#f4f6f8", color: "#0b1220", fontFamily: "Arial, sans-serif" },
  layout: { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" },
  sidebar: { background: "white", padding: 24, borderRight: "1px solid #e2e8f0" },
  logo: { fontWeight: 900, letterSpacing: "0.14em", marginBottom: 30 },
  nav: { display: "block", width: "100%", padding: "13px 15px", borderRadius: 14, border: 0, textAlign: "left", fontWeight: 800, cursor: "pointer", marginBottom: 8 },
  main: { padding: 32 },
  hero: { background: "#07111f", color: "white", borderRadius: 28, padding: 36, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 24 },
  eyebrow: { color: "#93c5fd", letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" },
  h1: { fontSize: 52, margin: "12px 0" },
  subtitle: { color: "#dbeafe", fontSize: 20 },
  heroActions: { display: "flex", gap: 10 },
  whiteBtn: { background: "white", color: "#0f172a", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  darkBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  kpiGridSmall: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "18px 0" },
  kpi: { background: "white", borderRadius: 22, padding: 24, cursor: "pointer", boxShadow: "0 8px 24px rgba(15,23,42,.06)" },
  kpiTitle: { color: "#64748b", fontSize: 14 },
  kpiValue: { fontSize: 34, fontWeight: 900, marginTop: 10 },
  card: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 24 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  actionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 },
  label: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 800, color: "#475569" },
  input: { width: "100%", padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 14 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1100 },
  th: { textAlign: "left", padding: 10, color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" },
  td: { padding: 8, borderBottom: "1px solid #e2e8f0" },
  productGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  productCard: { border: "1px solid #e2e8f0", borderRadius: 18, padding: 18 },
  muted: { color: "#64748b" },
  largeText: { fontSize: 18, color: "#334155", lineHeight: 1.6 },
  bar: { flex: 1, background: "#0f172a", color: "white", borderRadius: "16px 16px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, fontSize: 13 }
};
