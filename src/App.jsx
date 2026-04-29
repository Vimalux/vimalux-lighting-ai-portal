import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 15 – CLEAN INVESTOR DASHBOARD
   Stable React version – no Tailwind dependency
===================================================== */

const STORAGE_KEY = "vimalux_app_v15_state";
const ADMIN_PASSWORD = "vimalux-admin";

const defaultProducts = [
  { id: "urban45", name: "VIMALUX Urban 45", category: "Urban", watt: 45, lumen: 7650, sellPrice: 135, buyPrice: 95, install: 35 },
  { id: "street60", name: "VIMALUX Street 60", category: "Street", watt: 60, lumen: 10200, sellPrice: 155, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", category: "Road", watt: 90, lumen: 15300, sellPrice: 210, buyPrice: 150, install: 40 },
  { id: "highway120", name: "VIMALUX Highway 120", category: "Highway", watt: 120, lumen: 20400, sellPrice: 285, buyPrice: 205, install: 45 },
];

const defaultAssumptions = {
  energyPrice: 0.29,
  burningHours: 4200,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 80,
  smartNodeCost: 48,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  smartDimmingSavingPct: 18,
  cloSavingPct: 10,
  powerAidAdditionalSavingPct: 35,
  proposalYears: 10,
  financingMarginPct: 8,
  kgCo2PerKwh: 0.28,
};

const emptyProject = {
  customerName: "",
  municipality: "",
  country: "Italy",
  contactPerson: "",
  proposalDate: new Date().toISOString().slice(0, 10),
  quantity: 500,
  existingWatt: 100,
  selectedProductId: "street60",
  includeSmart: true,
  includePowerAid: false,
  includeInstallation: true,
  includeMaintenance: true,
  notes: "",
};

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = String(value).trim().replaceAll(" ", "");
  const normalized = raw.includes(",") ? raw.replaceAll(".", "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function inputNumber(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

function euro(value, decimals = 0) {
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
  return `€${formatted}`;
}

function num(value, decimals = 0) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
}

function pct(value) {
  return `${num(value, 1)}%`;
}

function safeProduct(products, selectedProductId) {
  return products.find((p) => p.id === selectedProductId) || products[0] || defaultProducts[0];
}

function calculate(project, assumptions, products) {
  const product = safeProduct(products, project.selectedProductId);
  const quantity = Math.max(0, toNumber(project.quantity));
  const oldWatt = Math.max(0, toNumber(project.existingWatt));
  const newWatt = Math.max(0, toNumber(product.watt));
  const hours = Math.max(0, toNumber(assumptions.burningHours));
  const energyPrice = Math.max(0, toNumber(assumptions.energyPrice));
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));

  const oldKwh = (quantity * oldWatt * hours) / 1000;
  const ledKwh = (quantity * newWatt * hours) / 1000;
  const smartSaving = project.includeSmart ? toNumber(assumptions.smartDimmingSavingPct) / 100 : 0;
  const cloSaving = project.includeSmart ? toNumber(assumptions.cloSavingPct) / 100 : 0;
  const smartBaseKwh = ledKwh * Math.max(0, 1 - smartSaving - cloSaving);
  const powerAidAdditionalSaving = project.includePowerAid ? toNumber(assumptions.powerAidAdditionalSavingPct) / 100 : 0;
  const finalKwh = smartBaseKwh * Math.max(0, 1 - powerAidAdditionalSaving);

  const oldEnergyCost = oldKwh * energyPrice;
  const newEnergyCost = finalKwh * energyPrice;
  const energySaving = Math.max(0, oldEnergyCost - newEnergyCost);
  const ledOnlyEnergyCost = ledKwh * energyPrice;
  const smartBaseEnergyCost = smartBaseKwh * energyPrice;
  const ledSaving = Math.max(0, oldEnergyCost - ledOnlyEnergyCost);
  const smartCmsSaving = project.includeSmart ? Math.max(0, ledOnlyEnergyCost - smartBaseEnergyCost) : 0;
  const powerAidSaving = project.includePowerAid ? Math.max(0, smartBaseEnergyCost - newEnergyCost) : 0;
  const maintenanceSaving = project.includeMaintenance
    ? quantity * toNumber(assumptions.maintenanceOldPerLamp) * (toNumber(assumptions.maintenanceSavingPct) / 100)
    : 0;

  const luminaireCapex = quantity * toNumber(product.sellPrice);
  const installationCapex = project.includeInstallation ? quantity * toNumber(product.install) : 0;
  const smartCapex = project.includeSmart ? quantity * toNumber(assumptions.smartNodeCost) : 0;
  const totalCapex = luminaireCapex + installationCapex + smartCapex;

  const cmsOpex = project.includeSmart ? quantity * toNumber(assumptions.cmsFeePerLampYear) : 0;
  const powerAidOpex = project.includePowerAid ? quantity * toNumber(assumptions.powerAidFeePerLampYear) : 0;
  const annualNewOpex = cmsOpex + powerAidOpex;
  const annualNetSaving = energySaving + maintenanceSaving - annualNewOpex;
  const paybackYears = annualNetSaving > 0 ? totalCapex / annualNetSaving : null;
  const financingMargin = totalCapex * (toNumber(assumptions.financingMarginPct) / 100);
  const laasAnnual = (totalCapex + financingMargin) / years + annualNewOpex;
  const laasMonthly = laasAnnual / 12;
  const co2SavedTons = ((oldKwh - finalKwh) * toNumber(assumptions.kgCo2PerKwh)) / 1000;

  return {
    product,
    quantity,
    oldKwh,
    finalKwh,
    oldEnergyCost,
    newEnergyCost,
    energySaving,
    ledSaving,
    smartCmsSaving,
    powerAidSaving,
    maintenanceSaving,
    annualNewOpex,
    annualNetSaving,
    totalCapex,
    luminaireCapex,
    installationCapex,
    smartCapex,
    paybackYears,
    financingMargin,
    investorValue: totalCapex + financingMargin,
    laasMonthly,
    laasAnnual,
    energyReductionPct: oldKwh > 0 ? ((oldKwh - finalKwh) / oldKwh) * 100 : 0,
    co2SavedTons,
    tenYearNetSavings: annualNetSaving * years,
    smartBaseKwh,
    ledKwh,
  };
}

function buildRows(calc, assumptions) {
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    return {
      year,
      oldEnergyCost: calc.oldEnergyCost,
      newEnergyCost: calc.newEnergyCost,
      energySaving: calc.energySaving,
      maintenanceSaving: calc.maintenanceSaving,
      newOpex: calc.annualNewOpex,
      netSaving: calc.annualNetSaving,
      cumulativeNetSaving: calc.annualNetSaving * year,
    };
  });
}

export default function VimaluxLightingPortalV15() {
  const [products, setProducts] = useState(defaultProducts);
  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [project, setProject] = useState(emptyProject);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.assumptions) setAssumptions({ ...defaultAssumptions, ...parsed.assumptions });
      if (parsed.project) setProject({ ...emptyProject, ...parsed.project });
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, assumptions, project }));
  }, [products, assumptions, project]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const calc = useMemo(() => calculate(project, assumptions, products), [project, assumptions, products]);
  const rows = useMemo(() => buildRows(calc, assumptions), [calc, assumptions]);
  const maxCumulative = Math.max(...rows.map((r) => r.cumulativeNetSaving), 1);

  function updateProject(field, value) {
    setProject((prev) => ({ ...prev, [field]: value }));
  }

  function updateAssumption(field, value) {
    // Store the raw input string so EU decimal input such as "0,42" remains editable.
    // Calculations convert values using toNumber().
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  }

  function updateProduct(id, field, value) {
    // Keep raw numeric input while editing; calculation converts safely with toNumber().
    setProducts((prev) =>
      prev.map((p) => p.id === id ? { ...p, [field]: field === "name" ? value : value } : p)
    );
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminMode(true);
      setAdminPassword("");
      setToast("Admin mode enabled");
    } else {
      setToast("Wrong admin password");
    }
  }

  function addProduct() {
    const id = `custom_${Date.now()}`;
    setProducts((prev) => [...prev, { id, name: "Custom Luminaire", category: "Custom", watt: 60, lumen: 10000, sellPrice: 150, buyPrice: 110, install: 35 }]);
    updateProject("selectedProductId", id);
  }

  function resetAll() {
    setProducts(defaultProducts);
    setAssumptions(defaultAssumptions);
    setProject(emptyProject);
    localStorage.removeItem(STORAGE_KEY);
    setToast("Dashboard reset");
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ ...project, product: calc.product.name, annualNetSaving: calc.annualNetSaving, totalCapex: calc.totalCapex, paybackYears: calc.paybackYears, laasMonthly: calc.laasMonthly }]), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Cashflow");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    XLSX.writeFile(wb, `VIMALUX_${project.municipality || "proposal"}_V15.xlsx`);
  }

  function exportPdfProposal() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(17, 19, 21);
    doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("VIMALUX Smart Lighting Investment Proposal", 14, 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Municipality: ${project.municipality || "-"}   Date: ${project.proposalDate}`, 14, 24);

    doc.setTextColor(20, 20, 20);
    autoTable(doc, {
      startY: 42,
      head: [["Executive KPI", "Value"]],
      body: [
        ["Annual net saving", euro(calc.annualNetSaving)],
        ["10Y net savings", euro(calc.tenYearNetSavings)],
        ["LED-only energy saving", euro(calc.ledSaving)],
        ["Smart CMS + CLO saving", euro(calc.smartCmsSaving)],
        ["PowerAiD additional saving", euro(calc.powerAidSaving)],
        ["Maintenance saving", euro(calc.maintenanceSaving)],
        ["New CMS / PowerAiD OPEX", euro(calc.annualNewOpex)],
        ["Total CAPEX", euro(calc.totalCapex)],
        ["Investor value", euro(calc.investorValue)],
        ["Payback", calc.paybackYears ? `${num(calc.paybackYears, 1)} years` : "N/A"],
        ["Energy reduction", pct(calc.energyReductionPct)],
        ["CO2 reduction / year", `${num(calc.co2SavedTons, 1)} t`],
        ["Suggested LaaS / month", euro(calc.laasMonthly)],
      ],
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Year", "LED Saving", "Smart/CLO", "PowerAiD", "Maintenance", "New OPEX", "Net Saving", "Cumulative"]],
      body: rows.map((r) => [r.year, euro(calc.ledSaving), euro(calc.smartCmsSaving), euro(calc.powerAidSaving), euro(r.maintenanceSaving), euro(r.newOpex), euro(r.netSaving), euro(r.cumulativeNetSaving)]),
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 8 },
    });

    doc.setFontSize(8);
    doc.text("Non-binding indication: all figures are indicative and subject to technical validation, financing approval, final product selection, legal structure and site verification.", 14, 285, { maxWidth: 182 });
    doc.save(`VIMALUX_${project.municipality || "proposal"}_V15.pdf`);
  }

  return (
    <div style={styles.page}>
      {toast && <div style={toast.toLowerCase().includes("wrong") ? styles.toastError : styles.toast}>{toast}</div>}
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.brandRow}><div style={styles.logoMark}>V</div><div><h1 style={styles.title}>VIMALUX Lighting AI Portal</h1><p style={styles.subtitle}>Version 15 – Investor Dashboard</p></div></div>
          </div>
          <div style={styles.headerActions}>
            <span style={adminMode ? styles.adminOn : styles.adminOff}>{adminMode ? "Admin enabled" : "Viewer mode"}</span>
            <span style={styles.dateBadge}>{new Date().toLocaleDateString("it-IT")}</span>
            <button onClick={exportPdfProposal} style={styles.primaryButton}>PDF Proposal</button>
            <button onClick={exportExcel} style={styles.secondaryButton}>Excel</button>
            <button onClick={resetAll} style={styles.ghostButton}>Reset</button>
          </div>
        </header>

        <section style={styles.kpiGrid}>
          <Kpi label="Annual Net Saving" value={euro(calc.annualNetSaving)} note="after CMS / PowerAiD OPEX" />
          <Kpi label="10Y Net Savings" value={euro(calc.tenYearNetSavings)} note="contract-period impact" />
          <Kpi label="Total CAPEX" value={euro(calc.totalCapex)} note="luminaires + install + smart" />
          <Kpi label="Payback" value={calc.paybackYears ? `${num(calc.paybackYears, 1)} yrs` : "N/A"} note="simple payback" />
          <Kpi label="Energy Reduction" value={pct(calc.energyReductionPct)} note="baseline vs smart LED" />
          <Kpi label="CO₂ Saved / Year" value={`${num(calc.co2SavedTons, 1)} t`} note="assumption-based" />
          <Kpi label="Investor Value" value={euro(calc.investorValue)} note="CAPEX + financing margin" />
          <Kpi label="Suggested LaaS / Month" value={euro(calc.laasMonthly)} note="indicative service price" />
        </section>

        <section style={styles.mainGrid}>
          <div style={styles.cardLarge}>
            <SectionTitle title="Project Input" sub="Municipality, baseline, product and service scope" />
            <div style={styles.formGrid}>
              <Input label="Customer" value={project.customerName} onChange={(v) => updateProject("customerName", v)} />
              <Input label="Municipality" value={project.municipality} onChange={(v) => updateProject("municipality", v)} />
              <Input label="Country" value={project.country} onChange={(v) => updateProject("country", v)} />
              <Input label="Contact person" value={project.contactPerson} onChange={(v) => updateProject("contactPerson", v)} />
              <Input label="Proposal date" type="date" value={project.proposalDate} onChange={(v) => updateProject("proposalDate", v)} />
              <Input label="Quantity" type="number" value={project.quantity} onChange={(v) => updateProject("quantity", toNumber(v))} />
              <Input label="Existing wattage" type="number" value={project.existingWatt} onChange={(v) => updateProject("existingWatt", toNumber(v))} />
              <label style={styles.field}><span style={styles.label}>Product</span><select style={styles.input} value={project.selectedProductId} onChange={(e) => updateProject("selectedProductId", e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name} – {p.watt}W – {euro(p.sellPrice)}</option>)}</select></label>
            </div>
            <div style={styles.toggleGrid}>
              <Toggle label="Smart CMS" checked={project.includeSmart} onChange={(v) => updateProject("includeSmart", v)} />
              <Toggle label="PowerAiD" checked={project.includePowerAid} onChange={(v) => updateProject("includePowerAid", v)} />
              <Toggle label="Installation" checked={project.includeInstallation} onChange={(v) => updateProject("includeInstallation", v)} />
              <Toggle label="Maintenance Saving" checked={project.includeMaintenance} onChange={(v) => updateProject("includeMaintenance", v)} />
            </div>
            <label style={styles.field}><span style={styles.label}>Notes</span><textarea style={styles.textarea} value={project.notes} onChange={(e) => updateProject("notes", e.target.value)} /></label>
          </div>

          <div style={styles.card}>
            <SectionTitle title="Savings Curve" sub="Cumulative cash effect" />
            <div style={styles.chartBox}>{rows.map((r) => <div key={r.year} style={styles.chartRow}><span style={styles.chartYear}>{r.year}</span><div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${Math.max(4, (r.cumulativeNetSaving / maxCumulative) * 100)}%` }} /></div><span style={styles.chartValue}>{euro(r.cumulativeNetSaving)}</span></div>)}</div>
          </div>
        </section>

        <section style={styles.twoGrid}>
          <div style={styles.card}>
            <SectionTitle title="Assumptions" sub="EU decimal input accepted: 0,29" />
            <div style={styles.formGrid}>{Object.entries(assumptions).map(([key, value]) => <Input key={key} label={key} type="number" value={value} onChange={(v) => updateAssumption(key, v)} />)}</div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardTop}><SectionTitle title="Admin Product Override" sub="Protected catalogue editing" />{adminMode && <span style={styles.adminOn}>Enabled</span>}</div>
            {!adminMode ? <div style={styles.adminLogin}><input style={styles.input} type="password" placeholder="Admin password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /><button onClick={unlockAdmin} style={styles.primaryButton}>Unlock</button></div> : <div style={styles.stack}><div style={styles.buttonRow}><button onClick={addProduct} style={styles.primaryButton}>Add Product</button><button onClick={() => setProducts(defaultProducts)} style={styles.secondaryButton}>Reset Products</button><button onClick={() => setAdminMode(false)} style={styles.ghostButton}>Lock</button></div><ProductTable products={products} updateProduct={updateProduct} /></div>}
          </div>
        </section>

        <section style={styles.card}>
          <SectionTitle title="Cashflow Preview" sub="Annual savings logic" />
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><Th left>Year</Th><Th>Old Energy</Th><Th>New Energy</Th><Th>LED Saving</Th><Th>Smart/CLO</Th><Th>PowerAiD</Th><Th>Maintenance</Th><Th>New OPEX</Th><Th>Net Saving</Th><Th>Cumulative</Th></tr></thead><tbody>{rows.map((r) => <tr key={r.year} style={styles.tr}><Td left>{r.year}</Td><Td>{euro(r.oldEnergyCost)}</Td><Td>{euro(r.newEnergyCost)}</Td><Td>{euro(calc.ledSaving)}</Td><Td>{euro(calc.smartCmsSaving)}</Td><Td>{euro(calc.powerAidSaving)}</Td><Td>{euro(r.maintenanceSaving)}</Td><Td>{euro(r.newOpex)}</Td><Td strong>{euro(r.netSaving)}</Td><Td strong>{euro(r.cumulativeNetSaving)}</Td></tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }) { return <div><h2 style={styles.sectionTitle}>{title}</h2><p style={styles.sectionSub}>{sub}</p></div>; }
function Kpi({ label, value, note }) { return <div style={styles.kpiCard}><div style={styles.kpiLabel}>{label}</div><div style={styles.kpiValue}>{value}</div><div style={styles.kpiNote}>{note}</div></div>; }
function Input({ label, value, onChange, type = "text" }) { return <label style={styles.field}><span style={styles.label}>{label}</span><input style={styles.input} type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} value={type === "number" ? inputNumber(value) : value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Toggle({ label, checked, onChange }) { return <label style={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>; }
function Th({ children, left }) { return <th style={left ? styles.thLeft : styles.thRight}>{children}</th>; }
function Td({ children, left, strong }) { return <td style={left ? styles.tdLeft : strong ? styles.tdStrong : styles.tdRight}>{children}</td>; }
function ProductTable({ products, updateProduct }) { return <div style={styles.tableWrapSmall}><table style={styles.table}><thead><tr><Th left>Name</Th><Th>W</Th><Th>lm</Th><Th>Sell</Th><Th>Buy</Th><Th>Install</Th></tr></thead><tbody>{products.map((p) => <tr key={p.id} style={styles.tr}><td style={styles.tdLeft}><input style={styles.adminInputWide} value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} /></td>{["watt", "lumen", "sellPrice", "buyPrice", "install"].map((field) => <td key={field} style={styles.tdRight}><input style={styles.adminInput} value={inputNumber(p[field])} inputMode="decimal" onChange={(e) => updateProduct(p.id, field, e.target.value)} /></td>)}</tr>)}</tbody></table></div>; }

const styles = {
  page: { minHeight: "100vh", background: "radial-gradient(circle at top left, #1e2429 0%, #111315 35%, #0b0d0f 100%)", color: "#f5f7fa", padding: 24, fontFamily: "Inter, Segoe UI, Arial, sans-serif" },
  shell: { maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", paddingBottom: 18, borderBottom: "1px solid #2b3137", flexWrap: "wrap" },
  brandRow: { display: "flex", gap: 14, alignItems: "center" },
  logoMark: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#f5f7fa", color: "#111315", fontWeight: 900, fontSize: 24 },
  title: { margin: 0, fontSize: 32, letterSpacing: "-0.035em", fontWeight: 850 },
  subtitle: { margin: "5px 0 0", color: "#9aa4ae", fontSize: 14 },
  headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryButton: { border: "1px solid #f5f7fa", background: "#f5f7fa", color: "#0b0d0f", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #384049", background: "#20252b", color: "#f5f7fa", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  ghostButton: { border: "1px solid #384049", background: "transparent", color: "#c8d0d8", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  adminOn: { background: "#0f6b3a", color: "#d9ffe8", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800 },
  adminOff: { background: "#252a30", color: "#aeb7c2", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800 },
  dateBadge: { background: "#171b20", border: "1px solid #2b3137", color: "#aeb7c2", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 700 },
  toast: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#0f6b3a", color: "#fff", borderRadius: 14, padding: "12px 16px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  toastError: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#7f1d1d", color: "#fff", borderRadius: 14, padding: "12px 16px", boxShadow: "0 16px 40px rgba(0,0,0,.35)" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 },
  kpiCard: { background: "linear-gradient(180deg,#1a1f24,#121519)", border: "1px solid #2b3137", borderRadius: 22, padding: 18, boxShadow: "0 18px 44px rgba(0,0,0,.24)" },
  kpiLabel: { color: "#9aa4ae", fontSize: 13, fontWeight: 800 },
  kpiValue: { fontSize: 30, lineHeight: 1.15, marginTop: 8, fontWeight: 900, letterSpacing: "-0.04em" },
  kpiNote: { color: "#727d88", fontSize: 12, marginTop: 7 },
  mainGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 },
  twoGrid: { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 24 },
  card: { background: "rgba(24,28,32,.96)", border: "1px solid #2b3137", borderRadius: 24, padding: 24, boxShadow: "0 18px 44px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", gap: 18 },
  cardLarge: { background: "rgba(24,28,32,.96)", border: "1px solid #2b3137", borderRadius: 24, padding: 24, boxShadow: "0 18px 44px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", gap: 18 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  sectionTitle: { margin: 0, fontSize: 23, fontWeight: 850, letterSpacing: "-0.025em" },
  sectionSub: { margin: "5px 0 0", color: "#8f9aa5", fontSize: 13 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 15 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#aeb7c2", fontSize: 13, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #384049", background: "#0f1215", color: "#fff", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  textarea: { width: "100%", minHeight: 104, boxSizing: "border-box", border: "1px solid #384049", background: "#0f1215", color: "#fff", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #2b3137", background: "#0f1215", padding: "12px 13px", borderRadius: 15, fontWeight: 750 },
  chartBox: { display: "flex", flexDirection: "column", gap: 11 },
  chartRow: { display: "grid", gridTemplateColumns: "28px 1fr 88px", gap: 10, alignItems: "center" },
  chartYear: { color: "#aeb7c2", fontWeight: 800 },
  barTrack: { height: 12, background: "#0f1215", borderRadius: 999, border: "1px solid #2b3137", overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#7dd3fc,#f5f7fa)", borderRadius: 999 },
  chartValue: { textAlign: "right", color: "#dce3ea", fontWeight: 800, fontSize: 12 },
  adminLogin: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10 },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  tableWrap: { overflowX: "auto", border: "1px solid #2b3137", borderRadius: 16 },
  tableWrapSmall: { overflowX: "auto", maxHeight: 390, border: "1px solid #2b3137", borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  thLeft: { textAlign: "left", background: "#101317", color: "#9aa4ae", padding: 12, whiteSpace: "nowrap" },
  thRight: { textAlign: "right", background: "#101317", color: "#9aa4ae", padding: 12, whiteSpace: "nowrap" },
  tr: { borderTop: "1px solid #2b3137" },
  tdLeft: { textAlign: "left", padding: 12, whiteSpace: "nowrap" },
  tdRight: { textAlign: "right", padding: 12, whiteSpace: "nowrap" },
  tdStrong: { textAlign: "right", padding: 12, whiteSpace: "nowrap", fontWeight: 900 },
  adminInput: { width: 92, textAlign: "right", border: "1px solid #384049", background: "#0f1215", color: "#fff", borderRadius: 10, padding: "8px 9px" },
  adminInputWide: { width: 205, border: "1px solid #384049", background: "#0f1215", color: "#fff", borderRadius: 10, padding: "8px 9px" },
};
