import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 17 – SALES MACHINE
   Dual mode: Customer / Admin
   Proposal engine: Municipality-ready commercial PDF
   Stable React version – no Tailwind dependency
===================================================== */

const STORAGE_KEY = "vimalux_app_v17_state";
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
  kgCo2PerKwh: 0.42,
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
  return `€${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value))}`;
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
  const ledOnlyEnergyCost = ledKwh * energyPrice;
  const smartBaseEnergyCost = smartBaseKwh * energyPrice;
  const newEnergyCost = finalKwh * energyPrice;

  const ledSaving = Math.max(0, oldEnergyCost - ledOnlyEnergyCost);
  const smartCmsSaving = project.includeSmart ? Math.max(0, ledOnlyEnergyCost - smartBaseEnergyCost) : 0;
  const powerAidSaving = project.includePowerAid ? Math.max(0, smartBaseEnergyCost - newEnergyCost) : 0;
  const energySaving = Math.max(0, oldEnergyCost - newEnergyCost);

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
  const annualGrossSaving = energySaving + maintenanceSaving;
  const annualNetSaving = annualGrossSaving - annualNewOpex;
  const paybackYears = annualNetSaving > 0 ? totalCapex / annualNetSaving : null;
  const financingMargin = totalCapex * (toNumber(assumptions.financingMarginPct) / 100);
  const investorValue = totalCapex + financingMargin;
  const laasAnnual = investorValue / years + annualNewOpex;
  const laasMonthly = laasAnnual / 12;
  const co2SavedTons = ((oldKwh - finalKwh) * toNumber(assumptions.kgCo2PerKwh)) / 1000;

  return {
    product,
    quantity,
    oldWatt,
    newWatt,
    oldKwh,
    ledKwh,
    smartBaseKwh,
    finalKwh,
    oldEnergyCost,
    ledOnlyEnergyCost,
    smartBaseEnergyCost,
    newEnergyCost,
    ledSaving,
    smartCmsSaving,
    powerAidSaving,
    energySaving,
    maintenanceSaving,
    annualGrossSaving,
    annualNewOpex,
    annualNetSaving,
    luminaireCapex,
    installationCapex,
    smartCapex,
    totalCapex,
    cmsOpex,
    powerAidOpex,
    paybackYears,
    financingMargin,
    investorValue,
    laasAnnual,
    laasMonthly,
    energyReductionPct: oldKwh > 0 ? ((oldKwh - finalKwh) / oldKwh) * 100 : 0,
    co2SavedTons,
    tenYearNetSavings: annualNetSaving * years,
  };
}

function buildRows(calc, assumptions) {
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));
  return Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    return {
      year,
      ledSaving: calc.ledSaving,
      smartCmsSaving: calc.smartCmsSaving,
      powerAidSaving: calc.powerAidSaving,
      maintenanceSaving: calc.maintenanceSaving,
      newOpex: calc.annualNewOpex,
      netSaving: calc.annualNetSaving,
      cumulativeNetSaving: calc.annualNetSaving * year,
    };
  });
}

export default function VimaluxLightingPortalV17() {
  const [products, setProducts] = useState(defaultProducts);
  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [project, setProject] = useState(emptyProject);
  const [adminMode, setAdminMode] = useState(false);
  const [viewMode, setViewMode] = useState("customer");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.assumptions) setAssumptions({ ...defaultAssumptions, ...parsed.assumptions });
      if (parsed.project) setProject({ ...emptyProject, ...parsed.project });
      if (parsed.adminMode) setAdminMode(parsed.adminMode);
      if (parsed.viewMode) setViewMode(parsed.viewMode);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, assumptions, project, adminMode, viewMode }));
  }, [products, assumptions, project, adminMode, viewMode]);

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
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  }

  function updateProduct(id, field, value) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, [field]: field === "name" ? value : value } : p));
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminMode(true);
      setViewMode("admin");
      setShowLogin(false);
      setAdminPassword("");
      setToast("Admin unlocked");
    } else {
      setToast("Wrong admin password");
    }
  }

  function logoutAdmin() {
    setAdminMode(false);
    setViewMode("customer");
    setShowLogin(false);
    setToast("Back to customer mode");
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
    setAdminMode(false);
    setViewMode("customer");
    localStorage.removeItem(STORAGE_KEY);
    setToast("Dashboard reset");
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ ...project, product: calc.product.name, annualNetSaving: calc.annualNetSaving, totalCapex: calc.totalCapex, paybackYears: calc.paybackYears, laasMonthly: calc.laasMonthly }]), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Cashflow");
    if (adminMode) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    XLSX.writeFile(wb, `VIMALUX_${project.municipality || "proposal"}_V17.xlsx`);
  }

  function addPdfFooter(doc, pageNo) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("VIMALUX – Smart Lighting / Smart City Infrastructure", 14, 287);
    doc.text(`Page ${pageNo}`, 190, 287, { align: "right" });
  }

  function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(17, 19, 21);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(25, 25, 25);
  }

  function exportPdfProposal() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const municipality = project.municipality || "Municipality";
    const customer = project.customerName || "Customer";

    // Page 1 – Cover
    doc.setFillColor(17, 19, 21);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("VIMALUX", 14, 28);
    doc.setFontSize(20);
    doc.text("Smart Public Lighting Proposal", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Prepared for: ${customer}`, 14, 68);
    doc.text(`Municipality: ${municipality}`, 14, 76);
    doc.text(`Date: ${project.proposalDate}`, 14, 84);

    doc.setDrawColor(125, 211, 252);
    doc.setLineWidth(1.2);
    doc.line(14, 98, 196, 98);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("From public lighting cost center", 14, 122);
    doc.text("to digital infrastructure asset", 14, 132);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("LED upgrade, Smart CMS, CLO, PowerAiD optimization, lower OPEX and optional LaaS financing.", 14, 148, { maxWidth: 170 });

    doc.setFillColor(26, 31, 36);
    doc.roundedRect(14, 172, 182, 64, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Executive snapshot", 24, 188);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Annual net saving: ${euro(calc.annualNetSaving)}`, 24, 202);
    doc.text(`Energy reduction: ${pct(calc.energyReductionPct)}`, 24, 212);
    doc.text(`Payback: ${calc.paybackYears ? `${num(calc.paybackYears, 1)} years` : "N/A"}`, 24, 222);
    addPdfFooter(doc, 1);

    // Page 2 – Current situation
    doc.addPage();
    pdfHeader(doc, "1. Current Situation", "Why action is financially and operationally relevant now");
    autoTable(doc, {
      startY: 42,
      head: [["Current baseline", "Estimated annual value"]],
      body: [
        ["Number of lighting points", num(calc.quantity)],
        ["Current average wattage", `${num(calc.oldWatt)} W`],
        ["Current annual energy consumption", `${num(calc.oldKwh)} kWh`],
        ["Current annual energy cost", euro(calc.oldEnergyCost)],
        ["Estimated maintenance baseline", euro(calc.quantity * toNumber(assumptions.maintenanceOldPerLamp))],
      ],
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 9 },
    });
    doc.setFontSize(10);
    doc.text("The current lighting infrastructure typically represents a recurring budget pressure: high energy use, manual operations, reactive maintenance and limited digital control.", 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
    addPdfFooter(doc, 2);

    // Page 3 – Proposed solution
    doc.addPage();
    pdfHeader(doc, "2. Proposed Solution", "LED + Smart CMS + CLO + optional PowerAiD optimization");
    autoTable(doc, {
      startY: 42,
      head: [["Layer", "Function", "Annual impact"]],
      body: [
        ["LED upgrade", `${calc.product.name} / ${num(calc.newWatt)} W`, euro(calc.ledSaving)],
        ["Smart CMS + CLO", `Adaptive dimming ${num(assumptions.smartDimmingSavingPct)}% + CLO ${num(assumptions.cloSavingPct)}%`, euro(calc.smartCmsSaving)],
        ["PowerAiD", project.includePowerAid ? `Additional optimization ${num(assumptions.powerAidAdditionalSavingPct)}%` : "Not included", euro(calc.powerAidSaving)],
        ["Maintenance optimization", project.includeMaintenance ? `${num(assumptions.maintenanceSavingPct)}% reduction assumption` : "Not included", euro(calc.maintenanceSaving)],
        ["New software / services OPEX", "CMS and PowerAiD recurring fees", `-${euro(calc.annualNewOpex)}`],
      ],
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 9 },
    });
    doc.setFontSize(10);
    doc.text("The value is created through stacked efficiency layers. LED delivers the first saving; Smart CMS and CLO optimize runtime and lumen output; PowerAiD adds further algorithmic optimization where selected.", 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
    addPdfFooter(doc, 3);

    // Page 4 – Financial impact
    doc.addPage();
    pdfHeader(doc, "3. Financial Impact", "Commercial decision summary");
    autoTable(doc, {
      startY: 42,
      head: [["Metric", "Value"]],
      body: [
        ["Annual gross saving", euro(calc.annualGrossSaving)],
        ["New recurring OPEX", `-${euro(calc.annualNewOpex)}`],
        ["Annual net saving", euro(calc.annualNetSaving)],
        ["10-year net saving", euro(calc.tenYearNetSavings)],
        ["Total CAPEX", euro(calc.totalCapex)],
        ["Simple payback", calc.paybackYears ? `${num(calc.paybackYears, 1)} years` : "N/A"],
        ["Suggested LaaS / month", euro(calc.laasMonthly)],
        ["CO2 reduction / year", `${num(calc.co2SavedTons, 1)} t`],
      ],
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 9 },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Year", "Net Saving", "Cumulative Net Saving"]],
      body: rows.map((r) => [r.year, euro(r.netSaving), euro(r.cumulativeNetSaving)]),
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 8 },
    });
    addPdfFooter(doc, 4);

    // Page 5 – Commercial options
    doc.addPage();
    pdfHeader(doc, "4. Commercial Options", "Purchase, LaaS or financed structure");
    autoTable(doc, {
      startY: 42,
      head: [["Option", "Description", "Indicative amount"]],
      body: [
        ["Direct CAPEX", "Municipality or ESCO purchases upgrade directly", euro(calc.totalCapex)],
        ["LaaS", "Lighting-as-a-Service with monthly service fee", `${euro(calc.laasMonthly)} / month`],
        ["Financed model", "Receivable-backed or investor-funded structure subject to approval", "Subject to DD"],
      ],
      headStyles: { fillColor: [17, 19, 21] },
      styles: { fontSize: 9 },
    });
    doc.setFontSize(10);
    doc.text("The preferred commercial structure depends on municipal constraints, budget classification, credit approval, contract duration and final technical scope.", 14, doc.lastAutoTable.finalY + 14, { maxWidth: 182 });
    addPdfFooter(doc, 5);

    // Page 6 – Why VIMALUX
    doc.addPage();
    pdfHeader(doc, "5. Why VIMALUX", "Smart lighting execution with financing logic");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 25);
    const bullets = [
      "Smart public lighting and Smart City infrastructure focus",
      "LED upgrade combined with CMS, CLO and optional PowerAiD optimization",
      "Hardware agnostic model with flexible luminaire and node selection",
      "Commercial models suitable for municipalities, ESCOs and infrastructure investors",
      "Structured approach to savings, service fees and receivable-backed financing options",
    ];
    bullets.forEach((b, i) => doc.text(`• ${b}`, 18, 48 + i * 12));
    doc.setFontSize(8);
    doc.text("Non-binding indication: figures are indicative and subject to technical validation, financing approval, final product selection, legal structure, credit assessment and site verification.", 14, 260, { maxWidth: 182 });
    addPdfFooter(doc, 6);

    doc.save(`VIMALUX_${municipality}_V17_proposal.pdf`);
  }

  const showAdminPanel = adminMode && viewMode === "admin";

  return (
    <div style={styles.page}>
      {toast && <div style={toast.toLowerCase().includes("wrong") ? styles.toastError : styles.toast}>{toast}</div>}
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <button style={styles.logoMark} onClick={() => setViewMode("customer")}>V</button>
            <div>
              <h1 style={styles.title}>VIMALUX Lighting AI Portal</h1>
              <p style={styles.subtitle}>Version 17 – Sales Machine</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button onClick={() => setViewMode("customer")} style={viewMode === "customer" ? styles.primaryButton : styles.secondaryButton}>Customer</button>
            {!adminMode && <button onClick={() => setShowLogin((v) => !v)} style={styles.secondaryButton}>Admin Login</button>}
            {adminMode && <button onClick={() => setViewMode("admin")} style={viewMode === "admin" ? styles.primaryButton : styles.secondaryButton}>Admin</button>}
            {adminMode && <button onClick={logoutAdmin} style={styles.ghostButton}>Logout</button>}
            <span style={styles.dateBadge}>{new Date().toLocaleDateString("it-IT")}</span>
            <button onClick={exportPdfProposal} style={styles.primaryButton}>PDF Proposal</button>
            <button onClick={exportExcel} style={styles.secondaryButton}>Excel</button>
            <button onClick={resetAll} style={styles.ghostButton}>Reset</button>
          </div>
        </header>

        {showLogin && !adminMode && (
          <section style={styles.loginBar}>
            <input style={styles.loginInput} type="password" placeholder="Admin password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") unlockAdmin(); }} />
            <button onClick={unlockAdmin} style={styles.primaryButton}>Unlock</button>
          </section>
        )}

        <section style={styles.kpiGrid}>
          <Kpi label="Annual Net Saving" value={euro(calc.annualNetSaving)} note="after CMS / PowerAiD OPEX" />
          <Kpi label="10Y Net Savings" value={euro(calc.tenYearNetSavings)} note="contract-period impact" />
          <Kpi label="Total CAPEX" value={euro(calc.totalCapex)} note="luminaires + install + smart" />
          <Kpi label="Payback" value={calc.paybackYears ? `${num(calc.paybackYears, 1)} yrs` : "N/A"} note="simple payback" />
          <Kpi label="Energy Reduction" value={pct(calc.energyReductionPct)} note="baseline vs optimized LED" />
          <Kpi label="CO₂ Saved / Year" value={`${num(calc.co2SavedTons, 1)} t`} note="assumption-based" />
          <Kpi label="LaaS / Month" value={euro(calc.laasMonthly)} note="indicative service price" />
          {showAdminPanel ? <Kpi label="Investor Value" value={euro(calc.investorValue)} note="CAPEX + margin" /> : <Kpi label="Smart Scope" value={project.includePowerAid ? "CMS + PowerAiD" : "CMS"} note="selected optimization layer" />}
        </section>

        <section style={styles.mainGrid}>
          <div style={styles.cardLarge}>
            <SectionTitle title="Project Input" sub="Customer-facing project assumptions" />
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
            <SectionTitle title="Value Stack" sub="How annual value is created" />
            <ValueLine label="LED-only saving" value={calc.ledSaving} max={calc.annualGrossSaving} />
            <ValueLine label="Smart CMS + CLO" value={calc.smartCmsSaving} max={calc.annualGrossSaving} />
            <ValueLine label="PowerAiD" value={calc.powerAidSaving} max={calc.annualGrossSaving} />
            <ValueLine label="Maintenance" value={calc.maintenanceSaving} max={calc.annualGrossSaving} />
            <ValueLine label="New OPEX" value={-calc.annualNewOpex} max={calc.annualGrossSaving} negative />
          </div>
        </section>

        {showAdminPanel && (
          <section style={styles.twoGrid}>
            <div style={styles.card}>
              <SectionTitle title="Admin Assumptions" sub="EU decimal input accepted: 0,29 / 0,42" />
              <div style={styles.formGrid}>{Object.entries(assumptions).map(([key, value]) => <Input key={key} label={key} type="number" value={value} onChange={(v) => updateAssumption(key, v)} />)}</div>
            </div>

            <div style={styles.card}>
              <div style={styles.cardTop}><SectionTitle title="Product Override" sub="Protected catalogue editing" /><span style={styles.adminOn}>Admin</span></div>
              <div style={styles.stack}>
                <div style={styles.buttonRow}><button onClick={addProduct} style={styles.primaryButton}>Add Product</button><button onClick={() => setProducts(defaultProducts)} style={styles.secondaryButton}>Reset Products</button></div>
                <ProductTable products={products} updateProduct={updateProduct} />
              </div>
            </div>
          </section>
        )}

        <section style={styles.card}>
          <SectionTitle title="Savings Curve" sub="Cumulative cash effect" />
          <div style={styles.chartBox}>{rows.map((r) => <div key={r.year} style={styles.chartRow}><span style={styles.chartYear}>{r.year}</span><div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${Math.max(4, (r.cumulativeNetSaving / maxCumulative) * 100)}%` }} /></div><span style={styles.chartValue}>{euro(r.cumulativeNetSaving)}</span></div>)}</div>
        </section>

        {showAdminPanel && (
          <section style={styles.card}>
            <SectionTitle title="Admin Cashflow Detail" sub="Internal calculation split" />
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr><Th left>Year</Th><Th>LED</Th><Th>Smart/CLO</Th><Th>PowerAiD</Th><Th>Maintenance</Th><Th>New OPEX</Th><Th>Net Saving</Th><Th>Cumulative</Th></tr></thead><tbody>{rows.map((r) => <tr key={r.year} style={styles.tr}><Td left>{r.year}</Td><Td>{euro(r.ledSaving)}</Td><Td>{euro(r.smartCmsSaving)}</Td><Td>{euro(r.powerAidSaving)}</Td><Td>{euro(r.maintenanceSaving)}</Td><Td>{euro(r.newOpex)}</Td><Td strong>{euro(r.netSaving)}</Td><Td strong>{euro(r.cumulativeNetSaving)}</Td></tr>)}</tbody></table></div>
          </section>
        )}
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
function ValueLine({ label, value, max, negative }) { const abs = Math.abs(toNumber(value)); const pctWidth = Math.max(4, Math.min(100, (abs / Math.max(1, toNumber(max))) * 100)); return <div style={styles.valueLine}><div style={styles.valueLineTop}><span>{label}</span><b>{negative ? `-${euro(abs)}` : euro(abs)}</b></div><div style={styles.valueTrack}><div style={{ ...styles.valueFill, background: negative ? "#ef4444" : "linear-gradient(90deg,#7dd3fc,#f5f7fa)", width: `${pctWidth}%` }} /></div></div>; }
function ProductTable({ products, updateProduct }) { return <div style={styles.tableWrapSmall}><table style={styles.table}><thead><tr><Th left>Name</Th><Th>W</Th><Th>lm</Th><Th>Sell</Th><Th>Buy</Th><Th>Install</Th></tr></thead><tbody>{products.map((p) => <tr key={p.id} style={styles.tr}><td style={styles.tdLeft}><input style={styles.adminInputWide} value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} /></td>{["watt", "lumen", "sellPrice", "buyPrice", "install"].map((field) => <td key={field} style={styles.tdRight}><input style={styles.adminInput} value={inputNumber(p[field])} inputMode="decimal" onChange={(e) => updateProduct(p.id, field, e.target.value)} /></td>)}</tr>)}</tbody></table></div>; }

const styles = {
  page: { minHeight: "100vh", background: "radial-gradient(circle at top left, #1e2429 0%, #111315 35%, #0b0d0f 100%)", color: "#f5f7fa", padding: 24, fontFamily: "Inter, Segoe UI, Arial, sans-serif" },
  shell: { maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", paddingBottom: 18, borderBottom: "1px solid #2b3137", flexWrap: "wrap" },
  brandRow: { display: "flex", gap: 14, alignItems: "center" },
  logoMark: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#f5f7fa", color: "#111315", fontWeight: 900, fontSize: 24, border: 0, cursor: "pointer" },
  title: { margin: 0, fontSize: 32, letterSpacing: "-0.035em", fontWeight: 850 },
  subtitle: { margin: "5px 0 0", color: "#9aa4ae", fontSize: 14 },
  headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  primaryButton: { border: "1px solid #f5f7fa", background: "#f5f7fa", color: "#0b0d0f", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #384049", background: "#20252b", color: "#f5f7fa", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  ghostButton: { border: "1px solid #384049", background: "transparent", color: "#c8d0d8", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  adminOn: { background: "#0f6b3a", color: "#d9ffe8", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800 },
  dateBadge: { background: "#171b20", border: "1px solid #2b3137", color: "#aeb7c2", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 700 },
  loginBar: { display: "flex", gap: 10, alignItems: "center", background: "#181c20", border: "1px solid #2b3137", borderRadius: 18, padding: 14 },
  loginInput: { width: 280, border: "1px solid #384049", background: "#0f1215", color: "#fff", borderRadius: 14, padding: "11px 13px", outline: "none" },
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
  valueLine: { display: "flex", flexDirection: "column", gap: 7 },
  valueLineTop: { display: "flex", justifyContent: "space-between", gap: 10, color: "#dce3ea", fontWeight: 800 },
  valueTrack: { height: 12, background: "#0f1215", borderRadius: 999, border: "1px solid #2b3137", overflow: "hidden" },
  valueFill: { height: "100%", borderRadius: 999 },
  chartBox: { display: "flex", flexDirection: "column", gap: 11 },
  chartRow: { display: "grid", gridTemplateColumns: "28px 1fr 95px", gap: 10, alignItems: "center" },
  chartYear: { color: "#aeb7c2", fontWeight: 800 },
  barTrack: { height: 12, background: "#0f1215", borderRadius: 999, border: "1px solid #2b3137", overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#7dd3fc,#f5f7fa)", borderRadius: 999 },
  chartValue: { textAlign: "right", color: "#dce3ea", fontWeight: 800, fontSize: 12 },
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
