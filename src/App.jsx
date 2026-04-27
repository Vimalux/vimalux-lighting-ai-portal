import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";

const products = [
  { id: "urban45", name: "VIMALUX Urban 45W Smart", watt: 45, lumen: 7650, sellPrice: 135, install: 45, category: "Urban" },
  { id: "street60", name: "VIMALUX Street Pro 60W Smart", watt: 60, lumen: 10200, sellPrice: 150, install: 45, category: "Street" },
  { id: "main90", name: "VIMALUX Main Road 90W Smart", watt: 90, lumen: 15300, sellPrice: 185, install: 50, category: "Main Road" },
  { id: "decor35", name: "VIMALUX Decorative Retrofit 35W Smart", watt: 35, lumen: 5600, sellPrice: 120, install: 50, category: "Decorative" }
];

const assumptions = {
  energyPrice: 0.29,
  maintenanceCost: 25,
  maintenanceReduction: 75,
  smartDimmingSaving: 15,
  powerAidExtraSaving: 8,
  years: 15,
  co2Factor: 0.42
};

const demoRows = [
  { id: 1, area: "Main roads", existingType: "HPS 150W", existingWatt: 150, qty: 320, hours: 4200 },
  { id: 2, area: "Urban roads", existingType: "HPS 120W", existingWatt: 120, qty: 500, hours: 4200 }
];

const labels = {
  EN: {
    version: "VIMALUX LIGHTING AI PORTAL · CUSTOMER SAFE MODE",
    title: "Smart LED ROI Calculator",
    subtitle: "Upload your lighting audit and compare LED, Smart and Smart + PowerAiD scenarios.",
    upload: "Upload audit Excel",
    demo: "Load demo case",
    dashboard: "Dashboard",
    proposal: "Proposal",
    client: "Client",
    totalLamps: "Total lamps",
    package: "Selected solution",
    capex: "Estimated project CAPEX",
    annualSaving: "Annual net saving",
    payback: "Simple payback",
    roi: "ROI/year",
    co2: "CO₂ saving/year",
    netBenefit: "15-year net benefit",
    led: "LED only",
    smart: "Smart LED",
    premium: "Smart LED + PowerAiD",
    energy: "Energy comparison",
    existing: "Existing system",
    newSystem: "New system",
    value: "Customer value",
    print: "Print / PDF",
    export: "Export analysis",
    proposalTitle: "Preliminary customer proposal",
    disclaimer: "Preliminary and non-binding. Final offer depends on technical audit, lighting design, product confirmation, installation conditions, contract structure and financing approval.",
    noRows: "No valid VIMALUX audit rows found. Check quantity in column D and wattage in column G."
  },
  IT: {
    version: "VIMALUX LIGHTING AI PORTAL · MODALITÀ CLIENTE",
    title: "Calcolatore ROI Smart LED",
    subtitle: "Carica l’audit illuminotecnico e confronta scenari LED, Smart e Smart + PowerAiD.",
    upload: "Carica audit Excel",
    demo: "Carica caso demo",
    dashboard: "Dashboard",
    proposal: "Proposta",
    client: "Cliente",
    totalLamps: "Totale lampade",
    package: "Soluzione selezionata",
    capex: "CAPEX progetto stimato",
    annualSaving: "Risparmio netto annuo",
    payback: "Payback semplice",
    roi: "ROI/anno",
    co2: "Risparmio CO₂/anno",
    netBenefit: "Beneficio netto 15 anni",
    led: "Solo LED",
    smart: "Smart LED",
    premium: "Smart LED + PowerAiD",
    energy: "Confronto energia",
    existing: "Sistema esistente",
    newSystem: "Nuovo sistema",
    value: "Valore per il cliente",
    print: "Stampa / PDF",
    export: "Esporta analisi",
    proposalTitle: "Proposta preliminare cliente",
    disclaimer: "Preliminare e non vincolante. Offerta finale soggetta ad audit tecnico, lighting design, conferma prodotto, condizioni installative, struttura contrattuale e approvazione finanziaria.",
    noRows: "Nessuna riga audit VIMALUX valida trovata. Verificare quantità in colonna D e wattaggio in colonna G."
  }
};

function eur(v) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(v || 0);
}

function num(v) {
  return new Intl.NumberFormat("en-IE", {
    maximumFractionDigits: 0
  }).format(v || 0);
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("vml_customer_lang") || "EN");
  const [page, setPage] = useState("dashboard");
  const [client, setClient] = useState("Comune Demo");
  const [packageType, setPackageType] = useState("premium");
  const [rows, setRows] = useState(demoRows);

  const t = labels[lang];

  useEffect(() => {
    localStorage.setItem("vml_customer_lang", lang);
  }, [lang]);

  function packageName(type) {
    if (type === "led") return t.led;
    if (type === "smart") return t.smart;
    return t.premium;
  }

  function packageFee(type) {
    if (type === "led") return 0;
    if (type === "smart") return 6;
    return 9;
  }

  function extraSavingPct(type) {
    if (type === "led") return 0;
    if (type === "smart") return assumptions.smartDimmingSaving;
    return assumptions.smartDimmingSaving + assumptions.powerAidExtraSaving;
  }

  function recommendProduct(watt) {
    const sorted = [...products].sort((a, b) => Number(a.watt) - Number(b.watt));
    const w = Number(watt);

    if (w >= 180) return products.find((p) => p.id === "main90") || sorted[sorted.length - 1];
    if (w >= 120) return products.find((p) => p.id === "street60") || sorted.find((p) => Number(p.watt) >= 60) || sorted[0];
    if (w >= 70) return products.find((p) => p.id === "urban45") || sorted.find((p) => Number(p.watt) >= 45) || sorted[0];

    return products.find((p) => p.id === "decor35") || sorted[0];
  }

  const analysed = useMemo(() => {
    return rows.map((row) => {
      const product = recommendProduct(row.existingWatt);
      const beforeKwh = (Number(row.existingWatt) * Number(row.qty) * Number(row.hours)) / 1000;
      const ledKwh = (Number(product.watt) * Number(row.qty) * Number(row.hours)) / 1000;
      const savingPct = extraSavingPct(packageType);
      const finalKwh = ledKwh * (1 - savingPct / 100);

      const energySaving = (beforeKwh - finalKwh) * assumptions.energyPrice;
      const maintenanceSaving =
        Number(row.qty) *
        assumptions.maintenanceCost *
        assumptions.maintenanceReduction /
        100;

      const serviceFee = Number(row.qty) * packageFee(packageType);
      const annualNetSaving = energySaving + maintenanceSaving - serviceFee;
      const customerCapex = Number(row.qty) * (Number(product.sellPrice) + Number(product.install));
      const payback = annualNetSaving > 0 ? customerCapex / annualNetSaving : 0;
      const roi = customerCapex > 0 ? annualNetSaving / customerCapex : 0;
      const co2 = ((beforeKwh - finalKwh) * assumptions.co2Factor) / 1000;

      return {
        ...row,
        product,
        beforeKwh,
        finalKwh,
        energySaving,
        maintenanceSaving,
        serviceFee,
        annualNetSaving,
        customerCapex,
        payback,
        roi,
        co2
      };
    });
  }, [rows, packageType]);

  const totals = useMemo(() => {
    const total = analysed.reduce(
      (a, r) => {
        a.qty += Number(r.qty);
        a.beforeKwh += r.beforeKwh;
        a.finalKwh += r.finalKwh;
        a.customerCapex += r.customerCapex;
        a.annualNetSaving += r.annualNetSaving;
        a.energySaving += r.energySaving;
        a.maintenanceSaving += r.maintenanceSaving;
        a.serviceFee += r.serviceFee;
        a.co2 += r.co2;
        return a;
      },
      {
        qty: 0,
        beforeKwh: 0,
        finalKwh: 0,
        customerCapex: 0,
        annualNetSaving: 0,
        energySaving: 0,
        maintenanceSaving: 0,
        serviceFee: 0,
        co2: 0
      }
    );

    total.payback = total.annualNetSaving > 0 ? total.customerCapex / total.annualNetSaving : 0;
    total.roi = total.customerCapex > 0 ? total.annualNetSaving / total.customerCapex : 0;
    total.netBenefit = total.annualNetSaving * assumptions.years - total.customerCapex;

    return total;
  }, [analysed]);

  async function importExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });

    const candidateSheets = [
      wb.Sheets["ProjectInputSheet"],
      wb.Sheets["ProjectInputSheet_ITA"],
      wb.Sheets[wb.SheetNames[0]]
    ].filter(Boolean);

    let bestRows = [];

    for (const ws of candidateSheets) {
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      const parsed = matrix
        .slice(14)
        .map((r, i) => ({
          id: Date.now() + i,
          area: r[1] || `Line ${i + 1}`,
          existingType: r[2] || "Existing luminaire",
          qty: Number(r[3] || 0),
          existingWatt: Number(r[6] || 0),
          hours: Number(r[8] || 4200)
        }))
        .filter((r) => r.qty > 0 && r.existingWatt > 0);

      if (parsed.length > bestRows.length) bestRows = parsed;
    }

    if (bestRows.length) {
      setRows(bestRows);
      setClient(file.name.replace(".xlsx", "").replace(".xls", ""));
      setPage("dashboard");
    } else {
      alert(t.noRows);
    }
  }

  function loadDemo() {
    setRows(demoRows);
    setClient("Comune Demo");
    setPackageType("premium");
    setPage("dashboard");
  }

  function exportAnalysis() {
    const header =
      "package,area,existingType,existingWatt,qty,hours,recommendedProduct,newWatt,totalCustomerCapex,annualNetSaving,payback,customerRoi,co2";

    const body = analysed
      .map((r) =>
        [
          packageName(packageType),
          r.area,
          r.existingType,
          r.existingWatt,
          r.qty,
          r.hours,
          r.product.name,
          r.product.watt,
          Math.round(r.customerCapex),
          Math.round(r.annualNetSaving),
          r.payback.toFixed(1),
          (r.roi * 100).toFixed(1) + "%",
          r.co2.toFixed(1)
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "vimalux_customer_roi.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>VIMALUX</div>

        <div style={styles.langWrap}>
          <button style={lang === "EN" ? styles.langActive : styles.langBtn} onClick={() => setLang("EN")}>
            EN
          </button>
          <button style={lang === "IT" ? styles.langActive : styles.langBtn} onClick={() => setLang("IT")}>
            IT
          </button>
        </div>

        <button style={navStyle(page === "dashboard")} onClick={() => setPage("dashboard")}>
          {t.dashboard}
        </button>
        <button style={navStyle(page === "proposal")} onClick={() => setPage("proposal")}>
          {t.proposal}
        </button>
      </aside>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>{t.version}</div>
            <h1 style={styles.h1}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <div style={styles.heroActions}>
            <button style={styles.whiteBtn} onClick={exportAnalysis}>
              {t.export}
            </button>
            <button style={styles.whiteBtn} onClick={() => window.print()}>
              {t.print}
            </button>
          </div>
        </section>

        <section style={styles.uploadCard}>
          <label style={styles.uploadBox}>
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display: "none" }} />
            <b>{t.upload}</b>
            <span>ProjectInputSheet / ProjectInputSheet_ITA</span>
          </label>

          <button style={styles.darkBtn} onClick={loadDemo}>
            {t.demo}
          </button>
        </section>

        <section style={styles.card}>
          <h2>{t.package}</h2>
          <div style={styles.packageGrid}>
            <button style={packageStyle(packageType === "led")} onClick={() => setPackageType("led")}>
              {t.led}
            </button>
            <button style={packageStyle(packageType === "smart")} onClick={() => setPackageType("smart")}>
              {t.smart}
            </button>
            <button style={packageStyle(packageType === "premium")} onClick={() => setPackageType("premium")}>
              {t.premium}
            </button>
          </div>
        </section>

        <section style={styles.kpiGrid}>
          <Kpi title={t.client} value={client} />
          <Kpi title={t.package} value={packageName(packageType)} />
          <Kpi title={t.totalLamps} value={num(totals.qty)} />
          <Kpi title={t.capex} value={eur(totals.customerCapex)} />
          <Kpi title={t.annualSaving} value={eur(totals.annualNetSaving)} />
          <Kpi title={t.payback} value={`${totals.payback.toFixed(1)} years`} />
          <Kpi title={t.roi} value={`${(totals.roi * 100).toFixed(1)}%`} />
          <Kpi title={t.netBenefit} value={eur(totals.netBenefit)} />
          <Kpi title={t.co2} value={`${num(totals.co2)} t`} />
        </section>

        {page === "dashboard" && (
          <section style={styles.grid2}>
            <Card title={t.energy}>
              <Compare label={t.existing} value={totals.beforeKwh} max={totals.beforeKwh} />
              <Compare label={t.newSystem} value={totals.finalKwh} max={totals.beforeKwh} />
            </Card>

            <Card title={t.value}>
              <Kpi title={t.annualSaving} value={eur(totals.annualNetSaving)} />
              <Kpi title={t.payback} value={`${totals.payback.toFixed(1)} years`} />
              <Kpi title={t.roi} value={`${(totals.roi * 100).toFixed(1)}%`} />
              <Kpi title={t.co2} value={`${num(totals.co2)} t`} />
            </Card>
          </section>
        )}

        {page === "proposal" && (
          <Card title={t.proposalTitle}>
            <p style={styles.largeText}>
              VIMALUX has analysed <b>{num(totals.qty)}</b> luminaires for <b>{client}</b>.
            </p>
            <p style={styles.largeText}>
              The selected solution is <b>{packageName(packageType)}</b>. The estimated total project CAPEX is <b>{eur(totals.customerCapex)}</b>.
            </p>
            <p style={styles.largeText}>
              Estimated annual net saving is <b>{eur(totals.annualNetSaving)}</b>, equal to a customer ROI of <b>{(totals.roi * 100).toFixed(1)}%</b> per year and a simple payback of <b>{totals.payback.toFixed(1)} years</b>.
            </p>
            <p style={styles.largeText}>
              Over 15 years, estimated net customer benefit is <b>{eur(totals.netBenefit)}</b>, with an annual CO₂ reduction of <b>{num(totals.co2)} t</b>.
            </p>
            <p style={styles.note}>{t.disclaimer}</p>
          </Card>
        )}
      </main>
    </div>
  );
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

function Compare({ label, value, max }) {
  const width = Math.max(5, (Number(value) / Math.max(Number(max), 1)) * 100);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={styles.compareTop}>
        <b>{label}</b>
        <span>{num(value)} kWh/year</span>
      </div>
      <div style={styles.barBg}>
        <div style={{ ...styles.bar, width: `${width}%` }} />
      </div>
    </div>
  );
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

function packageStyle(active) {
  return {
    padding: "16px 18px",
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 16,
    background: active ? "#0f172a" : "#e2e8f0",
    color: active ? "white" : "#0f172a"
  };
}

const styles = {
  app: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "250px 1fr",
    background: "#f4f6f8",
    color: "#0b1220",
    fontFamily: "Arial, sans-serif"
  },
  sidebar: {
    background: "white",
    padding: 24,
    borderRight: "1px solid #e2e8f0"
  },
  logo: {
    fontWeight: 900,
    letterSpacing: "0.14em",
    marginBottom: 20,
    fontSize: 22
  },
  langWrap: {
    display: "flex",
    gap: 8,
    marginBottom: 22
  },
  langBtn: {
    background: "#e2e8f0",
    color: "#0f172a",
    border: 0,
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer"
  },
  langActive: {
    background: "#0f172a",
    color: "white",
    border: 0,
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: "pointer"
  },
  main: {
    padding: 32,
    overflowX: "hidden"
  },
  hero: {
    background: "#07111f",
    color: "white",
    borderRadius: 28,
    padding: 36,
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 24
  },
  heroActions: {
    display: "flex",
    gap: 10
  },
  eyebrow: {
    color: "#93c5fd",
    letterSpacing: "0.16em",
    fontSize: 12,
    textTransform: "uppercase"
  },
  h1: {
    fontSize: 46,
    margin: "12px 0"
  },
  subtitle: {
    color: "#dbeafe",
    fontSize: 18
  },
  whiteBtn: {
    background: "white",
    color: "#0f172a",
    border: 0,
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer"
  },
  darkBtn: {
    background: "#0f172a",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer"
  },
  uploadCard: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
    marginBottom: 24,
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap"
  },
  uploadBox: {
    minWidth: 320,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    border: "2px dashed #cbd5e1",
    borderRadius: 20,
    padding: 28,
    cursor: "pointer",
    background: "#f8fafc"
  },
  packageGrid: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap"
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 24
  },
  kpi: {
    background: "white",
    borderRadius: 22,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
    marginBottom: 16
  },
  kpiTitle: {
    color: "#64748b",
    fontSize: 14
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 900,
    marginTop: 10
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16
  },
  card: {
    background: "white",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 8px 24px rgba(15,23,42,.06)",
    marginBottom: 24,
    overflow: "hidden"
  },
  compareTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6
  },
  barBg: {
    background: "#e2e8f0",
    borderRadius: 999,
    height: 18
  },
  bar: {
    background: "#0f172a",
    height: 18,
    borderRadius: 999
  },
  note: {
    background: "#f1f5f9",
    borderRadius: 18,
    padding: 16,
    color: "#475569",
    lineHeight: 1.5
  },
  largeText: {
    fontSize: 18,
    color: "#334155",
    lineHeight: 1.6
  }
};
