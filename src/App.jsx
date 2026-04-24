import React, { useMemo, useState } from "react";

const products = [
  { id: "urban45", name: "VIMALUX Urban 45W Smart", watt: 45, price: 135, install: 45, category: "Urban", tags: "Zhaga / D4i / CMS" },
  { id: "street60", name: "VIMALUX Street Pro 60W Smart", watt: 60, price: 150, install: 45, category: "Street", tags: "Zhaga / D4i / CMS / CLO" },
  { id: "main90", name: "VIMALUX Main Road 90W Smart", watt: 90, price: 185, install: 50, category: "Main Road", tags: "Zhaga / D4i / Traffic Dimming" },
  { id: "decor35", name: "VIMALUX Decorative Retrofit 35W Smart", watt: 35, price: 120, install: 50, category: "Decorative", tags: "Retrofit / CMS" }
];

function eur(v) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function num(v) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(v || 0);
}

function recommendProduct(oldWatt) {
  if (oldWatt >= 180) return products.find(p => p.id === "main90");
  if (oldWatt >= 120) return products.find(p => p.id === "street60");
  if (oldWatt >= 70) return products.find(p => p.id === "urban45");
  return products.find(p => p.id === "decor35");
}

export default function App() {
  const [page, setPage] = useState("revenue");
  const [lang, setLang] = useState("EN");

  const [input, setInput] = useState({
    municipality: "Comune Demo",
    lamps: 910,
    oldWatt: 120,
    hours: 4200,
    energyPrice: 0.27,
    maintenanceCost: 25,
    smartExtraSaving: 22,
    softwareCost: 6,
    powerAidCost: 3,
    years: 15,
    investorMultiple: 8,
    projectYears: 15,
    municipalityRating: "A",
    receivablesAssignment: "Yes",
    currentLedEfficacy: 130,
    newLedEfficacy: 170
  });

  const [lead, setLead] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "Italy",
    lampsOwned: "",
    interest: "Smart upgrade",
    message: ""
  });

  const selectedProduct = useMemo(() => recommendProduct(Number(input.oldWatt)), [input.oldWatt]);

  const result = useMemo(() => {
    const lamps = Number(input.lamps);
    const oldWatt = Number(input.oldWatt);
    const hours = Number(input.hours);
    const energy = Number(input.energyPrice);

    const beforeKwh = lamps * oldWatt * hours / 1000;
    const ledOnlyKwh = lamps * selectedProduct.watt * hours / 1000;
    const smartKwh = ledOnlyKwh * (1 - Number(input.smartExtraSaving) / 100);

    const beforeEnergyCost = beforeKwh * energy;
    const smartEnergyCost = smartKwh * energy;

    const energySavingSmart = beforeEnergyCost - smartEnergyCost;
    const maintenanceSaving = lamps * Number(input.maintenanceCost) * 0.75;
    const softwareOpex = lamps * (Number(input.softwareCost) + Number(input.powerAidCost));

    const annualNetSaving = energySavingSmart + maintenanceSaving - softwareOpex;
    const capex = lamps * (selectedProduct.price + selectedProduct.install);
    const payback = annualNetSaving > 0 ? capex / annualNetSaving : 0;
    const valuePeriod = annualNetSaving * Number(input.years) - capex;
    const investorValue = annualNetSaving * Number(input.investorMultiple);
    const co2Saving = (beforeKwh - smartKwh) * 0.35 / 1000;

    const smartUpgradeSavingPct =
      ((Number(input.newLedEfficacy) / Number(input.currentLedEfficacy) - 1) * 100) +
      Number(input.smartExtraSaving);

    const financingFee = capex * 0.03;
    const advisoryFee = capex * 0.015;
    const recurringSaas = lamps * Number(input.softwareCost);

    const annualRevenuePotential = recurringSaas + advisoryFee / 3 + financingFee / 3;

    return {
      beforeKwh,
      ledOnlyKwh,
      smartKwh,
      energySavingSmart,
      maintenanceSaving,
      softwareOpex,
      annualNetSaving,
      capex,
      payback,
      valuePeriod,
      investorValue,
      co2Saving,
      smartUpgradeSavingPct,
      financingFee,
      advisoryFee,
      recurringSaas,
      annualRevenuePotential
    };
  }, [input, selectedProduct]);

  const t = lang === "IT" ? {
    title: "VIMALUX Revenue Machine",
    subtitle: "Lead generation, ROI, proposta, finanziamento e dashboard investitore.",
    revenue: "Revenue",
    calculator: "Calcolatore",
    proposal: "Proposta",
    financing: "Finanza",
    smartUpgrade: "Smart Upgrade",
    investor: "Investitore",
    leads: "Lead"
  } : {
    title: "VIMALUX Revenue Machine",
    subtitle: "Lead generation, ROI, proposal, financing and investor dashboard.",
    revenue: "Revenue",
    calculator: "Calculator",
    proposal: "Proposal",
    financing: "Financing",
    smartUpgrade: "Smart Upgrade",
    investor: "Investor",
    leads: "Leads"
  };

  function update(field, value) {
    setInput(prev => ({ ...prev, [field]: value }));
  }

  function exportCsv() {
    const rows = [
      ["Municipality", input.municipality],
      ["Lamps", input.lamps],
      ["Existing watt", input.oldWatt],
      ["Recommended product", selectedProduct.name],
      ["CAPEX", Math.round(result.capex)],
      ["Annual net saving", Math.round(result.annualNetSaving)],
      ["Payback", result.payback.toFixed(1)],
      ["Investor value proxy", Math.round(result.investorValue)],
      ["Recurring SaaS annual", Math.round(result.recurringSaas)],
      ["Financing fee proxy", Math.round(result.financingFee)]
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vimalux-revenue-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveLead() {
    alert("Lead captured in demo. Next step: connect this form to Airtable, HubSpot, Supabase or email automation.");
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>VIMALUX</div>
        <Nav label={t.revenue} id="revenue" page={page} setPage={setPage} />
        <Nav label={t.calculator} id="calculator" page={page} setPage={setPage} />
        <Nav label={t.proposal} id="proposal" page={page} setPage={setPage} />
        <Nav label={t.financing} id="financing" page={page} setPage={setPage} />
        <Nav label={t.smartUpgrade} id="smartUpgrade" page={page} setPage={setPage} />
        <Nav label={t.investor} id="investor" page={page} setPage={setPage} />
        <Nav label={t.leads} id="leads" page={page} setPage={setPage} />

        <div style={{ marginTop: 30 }}>
          <button style={styles.smallBtn} onClick={() => setLang("EN")}>EN</button>
          <button style={styles.smallBtn} onClick={() => setLang("IT")}>IT</button>
        </div>
      </aside>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>VIMALUX LIGHTING AI PORTAL · VERSION 5A</div>
            <h1 style={styles.h1}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.whiteBtn} onClick={exportCsv}>Export CSV</button>
            <button style={styles.whiteBtn} onClick={() => window.print()}>Print / PDF</button>
          </div>
        </section>

        <section style={styles.kpiGrid}>
          <Kpi title="Recommended product" value={selectedProduct.name} />
          <Kpi title="Estimated CAPEX" value={eur(result.capex)} />
          <Kpi title="Annual net saving" value={eur(result.annualNetSaving)} />
          <Kpi title="Simple payback" value={`${result.payback.toFixed(1)} years`} />
          <Kpi title="Recurring SaaS/year" value={eur(result.recurringSaas)} />
          <Kpi title="VIMALUX annual potential" value={eur(result.annualRevenuePotential)} />
        </section>

        {page === "revenue" && (
          <section style={styles.grid2}>
            <Card title="Revenue Engine">
              <div style={styles.kpiGridSmall}>
                <Kpi title="Product CAPEX" value={eur(result.capex)} />
                <Kpi title="Financing fee proxy" value={eur(result.financingFee)} />
                <Kpi title="Advisory fee proxy" value={eur(result.advisoryFee)} />
                <Kpi title="SaaS annual revenue" value={eur(result.recurringSaas)} />
              </div>
              <p style={styles.note}>
                Version 5A turns the calculator into a commercial funnel: product sale, SaaS recurring revenue, financing fee and advisory fee.
              </p>
            </Card>

            <Card title="Lead qualification">
              <div style={styles.formGrid}>
                <TextInput label="Company / Municipality" value={lead.company} onChange={v => setLead({ ...lead, company: v })} />
                <TextInput label="Email" value={lead.email} onChange={v => setLead({ ...lead, email: v })} />
                <SelectInput label="Interest type" value={lead.interest} onChange={v => setLead({ ...lead, interest: v })} options={["Buy products", "Smart upgrade", "Financing", "Acquisition", "Become partner"]} />
                <TextInput label="Lamps owned" value={lead.lampsOwned} onChange={v => setLead({ ...lead, lampsOwned: v })} />
              </div>
              <button style={styles.darkBtn} onClick={saveLead}>Capture lead</button>
            </Card>
          </section>
        )}

        {page === "calculator" && (
          <section style={styles.grid2}>
            <Card title="Live ROI Calculator">
              <div style={styles.formGrid}>
                <TextInput label="Municipality / Client" value={input.municipality} onChange={v => update("municipality", v)} />
                <NumberInput label="Number of lamps" value={input.lamps} onChange={v => update("lamps", v)} />
                <NumberInput label="Existing wattage" value={input.oldWatt} onChange={v => update("oldWatt", v)} />
                <NumberInput label="Annual burning hours" value={input.hours} onChange={v => update("hours", v)} />
                <NumberInput label="Energy price €/kWh" value={input.energyPrice} step="0.01" onChange={v => update("energyPrice", v)} />
                <NumberInput label="Smart extra saving %" value={input.smartExtraSaving} onChange={v => update("smartExtraSaving", v)} />
                <NumberInput label="Software €/lamp/year" value={input.softwareCost} onChange={v => update("softwareCost", v)} />
                <NumberInput label="PowerAiD €/lamp/year" value={input.powerAidCost} onChange={v => update("powerAidCost", v)} />
              </div>
            </Card>

            <Card title="Consumption comparison">
              <Compare label="Existing system" value={result.beforeKwh} max={result.beforeKwh} />
              <Compare label="LED-only" value={result.ledOnlyKwh} max={result.beforeKwh} />
              <Compare label="Smart LED" value={result.smartKwh} max={result.beforeKwh} />
            </Card>
          </section>
        )}

        {page === "proposal" && (
          <Card title={`Proposal for ${input.municipality}`}>
            <p style={styles.largeText}>
              VIMALUX proposes to replace approximately <b>{num(input.lamps)}</b> existing luminaires currently estimated at <b>{input.oldWatt}W</b> with <b>{selectedProduct.name}</b>.
            </p>
            <p style={styles.largeText}>
              Estimated CAPEX: <b>{eur(result.capex)}</b>. Annual net saving: <b>{eur(result.annualNetSaving)}</b>. Simple payback: <b>{result.payback.toFixed(1)} years</b>.
            </p>
            <p style={styles.largeText}>
              The project can be structured as direct purchase, ESCO upgrade, leasing, or investor-backed receivables assignment depending on municipal credit profile and contract duration.
            </p>
            <p style={styles.note}>
              Preliminary and non-binding. Final values depend on technical audit, lighting design, contract structure, installation conditions and credit approval.
            </p>
            <button style={styles.darkBtn} onClick={() => window.print()}>Generate PDF / Print</button>
          </Card>
        )}

        {page === "financing" && (
          <section style={styles.grid2}>
            <Card title="Financing Engine">
              <div style={styles.formGrid}>
                <NumberInput label="Contract years" value={input.projectYears} onChange={v => update("projectYears", v)} />
                <SelectInput label="Municipality rating" value={input.municipalityRating} onChange={v => update("municipalityRating", v)} options={["A", "B", "C", "Unknown"]} />
                <SelectInput label="Receivables assignment" value={input.receivablesAssignment} onChange={v => update("receivablesAssignment", v)} options={["Yes", "No", "To be evaluated"]} />
              </div>
              <p style={styles.largeText}>
                Financing-ready value proxy: <b>{eur(result.investorValue)}</b>
              </p>
              <p style={styles.note}>
                Best structure: SPV / ESCO model with irrevocable assignment of future receivables where legally and commercially feasible.
              </p>
            </Card>

            <Card title="Commercial angle">
              <Kpi title="Financing fee proxy" value={eur(result.financingFee)} />
              <Kpi title="Advisory fee proxy" value={eur(result.advisoryFee)} />
            </Card>
          </section>
        )}

        {page === "smartUpgrade" && (
          <section style={styles.grid2}>
            <Card title="Smart Upgrade Engine">
              <div style={styles.formGrid}>
                <NumberInput label="Current LED efficacy lm/W" value={input.currentLedEfficacy} onChange={v => update("currentLedEfficacy", v)} />
                <NumberInput label="New LED efficacy lm/W" value={input.newLedEfficacy} onChange={v => update("newLedEfficacy", v)} />
                <NumberInput label="Smart dimming saving %" value={input.smartExtraSaving} onChange={v => update("smartExtraSaving", v)} />
              </div>
              <Kpi title="Estimated upgrade potential" value={`${result.smartUpgradeSavingPct.toFixed(1)}%`} />
              <p style={styles.note}>
                Use this module for municipalities already upgraded to LED but without CMS, CLO, adaptive dimming or DATEK-style smart control.
              </p>
            </Card>

            <Card title="DATEK / CMS sales argument">
              <p style={styles.largeText}>
                Smart upgrade is not only energy saving. It creates a digital lighting infrastructure with monitoring, fault detection, adaptive control and recurring software revenue.
              </p>
            </Card>
          </section>
        )}

        {page === "investor" && (
          <Card title="Investor Dashboard">
            <div style={styles.kpiGridSmall}>
              <Kpi title="Annual net cashflow" value={eur(result.annualNetSaving)} />
              <Kpi title="Portfolio value proxy" value={eur(result.investorValue)} />
              <Kpi title={`${input.years}Y net value`} value={eur(result.valuePeriod)} />
              <Kpi title="CO₂ saving/year" value={`${num(result.co2Saving)} t`} />
            </div>
            <p style={styles.note}>
              Next version should add IRR, DSCR, debt sizing, receivables purchase price, SPV waterfall and portfolio roll-up.
            </p>
          </Card>
        )}

        {page === "leads" && (
          <Card title="Lead Capture Pro">
            <div style={styles.formGrid}>
              <TextInput label="Name" value={lead.name} onChange={v => setLead({ ...lead, name: v })} />
              <TextInput label="Company / Municipality" value={lead.company} onChange={v => setLead({ ...lead, company: v })} />
              <TextInput label="Email" value={lead.email} onChange={v => setLead({ ...lead, email: v })} />
              <TextInput label="Phone" value={lead.phone} onChange={v => setLead({ ...lead, phone: v })} />
              <TextInput label="Country" value={lead.country} onChange={v => setLead({ ...lead, country: v })} />
              <TextInput label="Lamps owned" value={lead.lampsOwned} onChange={v => setLead({ ...lead, lampsOwned: v })} />
              <SelectInput label="Interest type" value={lead.interest} onChange={v => setLead({ ...lead, interest: v })} options={["Buy products", "Smart upgrade", "Financing", "Acquisition", "Become partner"]} />
            </div>
            <label style={styles.label}>
              Message
              <textarea style={{ ...styles.input, minHeight: 110 }} value={lead.message} onChange={e => setLead({ ...lead, message: e.target.value })} />
            </label>
            <br />
            <button style={styles.darkBtn} onClick={saveLead}>Save lead</button>
          </Card>
        )}
      </main>
    </div>
  );
}

function Nav({ label, id, page, setPage }) {
  return <button style={navStyle(page === id)} onClick={() => setPage(id)}>{label}</button>;
}

function navStyle(active) {
  return {
    width: "100%",
    padding: "14px 16px",
    border: 0,
    borderRadius: 14,
    fontWeight: 800,
    textAlign: "left",
    cursor: "pointer",
    marginBottom: 8,
    background: active ? "#0f172a" : "transparent",
    color: active ? "white" : "#0f172a"
  };
}

function Kpi({ title, value }) {
  return (
    <div style={styles.kpi}>
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

function NumberInput({ label, value, onChange, step = "1" }) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} type="number" step={step} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label style={styles.label}>
      {label}
      <input style={styles.input} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label style={styles.label}>
      {label}
      <select style={styles.input} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Compare({ label, value, max }) {
  const width = Math.max(5, (value / max) * 100);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <b>{label}</b>
        <span>{num(value)} kWh/year</span>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 999, height: 18 }}>
        <div style={{ background: "#0f172a", width: `${width}%`, height: 18, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", display: "grid", gridTemplateColumns: "260px 1fr", background: "#f4f6f8", color: "#0b1220", fontFamily: "Arial, sans-serif" },
  sidebar: { background: "white", padding: 24, borderRight: "1px solid #e2e8f0" },
  logo: { fontWeight: 900, letterSpacing: "0.14em", marginBottom: 30, fontSize: 20 },
  main: { padding: 32 },
  hero: { background: "#07111f", color: "white", borderRadius: 28, padding: 36, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 24 },
  eyebrow: { color: "#93c5fd", letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" },
  h1: { fontSize: 52, margin: "12px 0" },
  subtitle: { color: "#dbeafe", fontSize: 20 },
  whiteBtn: { background: "white", color: "#0f172a", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  darkBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  smallBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 10, padding: "8px 12px", marginRight: 8, cursor: "pointer" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  kpiGridSmall: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "18px 0" },
  kpi: { background: "white", borderRadius: 22, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 16 },
  kpiTitle: { color: "#64748b", fontSize: 14 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 10 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 24 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 },
  label: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 800, color: "#475569" },
  input: { width: "100%", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 14 },
  muted: { color: "#64748b", lineHeight: 1.5 },
  largeText: { fontSize: 18, color: "#334155", lineHeight: 1.6 },
  note: { background: "#f1f5f9", borderRadius: 18, padding: 16, color: "#475569", lineHeight: 1.5 }
};
