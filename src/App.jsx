import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 22 – LIVE MONEY ENGINE
   Full dynamic CFO engine + offer comparison + PDF + Excel
   Stable React version – no Tailwind dependency
===================================================== */

const STORAGE_KEY = "vimalux_app_v22_state";
const ADMIN_PASSWORD = "vimalux-admin";

const defaultProducts = [
  { id: "urban45", name: "VIMALUX Urban 45", watt: 45, lumen: 7650, sellPrice: 135, buyPrice: 95, install: 35 },
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 10200, sellPrice: 155, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 15300, sellPrice: 210, buyPrice: 150, install: 40 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, lumen: 20400, sellPrice: 285, buyPrice: 205, install: 45 },
];

const defaultAssumptions = {
  ledSavingPct: 55,
  energyPrice: 0.29,
  burningHours: 4200,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  cloSavingPct: 10,
  powerAidAdditionalSavingPct: 20,
  proposalYears: 10,
  financingMarginPct: 8,
  kgCo2PerKwh: 0.42,
  discountRatePct: 7,
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
  includeInstallation: true,
  includeMaintenance: true,
  selectedOffer: "smart_poweraid",
  notes: "",
};

const offers = [
  { id: "led", title: "LED Only", badge: "Base", smart: false, powerAid: false, positioning: "Fastest entry point" },
  { id: "smart", title: "Smart CMS", badge: "Recommended", smart: true, powerAid: false, positioning: "Control + CLO + maintenance" },
  { id: "smart_poweraid", title: "Smart + PowerAiD", badge: "Premium", smart: true, powerAid: true, positioning: "Maximum optimization" },
];

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
  return `€${new Intl.NumberFormat("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(toNumber(value))}`;
}

function num(value, decimals = 0) {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(toNumber(value));
}

function pct(value) {
  return `${num(value, 1)}%`;
}

function safeProduct(products, selectedProductId) {
  return products.find((p) => p.id === selectedProductId) || products[0] || defaultProducts[0];
}

function npv(ratePct, annualCash, years, initialCapex) {
  const rate = toNumber(ratePct) / 100;
  let value = -initialCapex;
  for (let y = 1; y <= years; y += 1) value += annualCash / Math.pow(1 + rate, y);
  return value;
}

function simpleIrr(annualCash, years, initialCapex) {
  if (initialCapex <= 0 || annualCash <= 0) return null;
  let low = -0.9;
  let high = 1.5;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    let v = -initialCapex;
    for (let y = 1; y <= years; y += 1) v += annualCash / Math.pow(1 + mid, y);
    if (v > 0) low = mid; else high = mid;
  }
  return ((low + high) / 2) * 100;
}

function calculateOffer(project, assumptions, products, offerId) {
  const offer = offers.find((o) => o.id === offerId) || offers[0];
  const product = safeProduct(products, project.selectedProductId);
  const quantity = Math.max(0, toNumber(project.quantity));
  const oldWatt = Math.max(0, toNumber(project.existingWatt));
  const hours = Math.max(0, toNumber(assumptions.burningHours));
  const energyPrice = Math.max(0, toNumber(assumptions.energyPrice));
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));

  const ledSavingPct = Math.max(0, Math.min(100, toNumber(assumptions.ledSavingPct))) / 100;
  const cloSavingPct = offer.smart ? Math.max(0, Math.min(100, toNumber(assumptions.cloSavingPct))) / 100 : 0;
  const powerAidPct = offer.powerAid ? Math.max(0, Math.min(100, toNumber(assumptions.powerAidAdditionalSavingPct))) / 100 : 0;

  const oldKwh = (quantity * oldWatt * hours) / 1000;
  const postLedKwh = oldKwh * (1 - ledSavingPct);
  const postCloKwh = offer.smart ? postLedKwh * (1 - cloSavingPct) : postLedKwh;
  const finalKwh = offer.powerAid ? postCloKwh * (1 - powerAidPct) : postCloKwh;

  const oldEnergyCost = oldKwh * energyPrice;
  const postLedEnergyCost = postLedKwh * energyPrice;
  const postCloEnergyCost = postCloKwh * energyPrice;
  const newEnergyCost = finalKwh * energyPrice;

  const ledSaving = Math.max(0, oldEnergyCost - postLedEnergyCost);
  const cloSaving = offer.smart ? Math.max(0, postLedEnergyCost - postCloEnergyCost) : 0;
  const powerAidSaving = offer.powerAid ? Math.max(0, postCloEnergyCost - newEnergyCost) : 0;
  const energySaving = Math.max(0, oldEnergyCost - newEnergyCost);
  const maintenanceSaving = project.includeMaintenance && offer.smart
    ? quantity * toNumber(assumptions.maintenanceOldPerLamp) * (toNumber(assumptions.maintenanceSavingPct) / 100)
    : 0;

  const luminaireCapex = quantity * toNumber(product.sellPrice);
  const installationCapex = project.includeInstallation ? quantity * toNumber(product.install) : 0;
  const smartCapex = offer.smart ? quantity * toNumber(assumptions.smartNodeCost) : 0;
  const totalCapex = luminaireCapex + installationCapex + smartCapex;

  const cmsOpex = offer.smart ? quantity * toNumber(assumptions.cmsFeePerLampYear) : 0;
  const powerAidOpex = offer.powerAid ? quantity * toNumber(assumptions.powerAidFeePerLampYear) : 0;
  const annualNewOpex = cmsOpex + powerAidOpex;
  const annualGrossSaving = energySaving + maintenanceSaving;
  const annualNetSaving = annualGrossSaving - annualNewOpex;
  const paybackYears = annualNetSaving > 0 ? totalCapex / annualNetSaving : null;

  const financingMargin = totalCapex * (toNumber(assumptions.financingMarginPct) / 100);
  const investorValue = totalCapex + financingMargin;
  const laasAnnual = investorValue / years + annualNewOpex;
  const laasMonthly = laasAnnual / 12;
  const tenYearNetSavings = annualNetSaving * years;
  const co2SavedTons = ((oldKwh - finalKwh) * toNumber(assumptions.kgCo2PerKwh)) / 1000;
  const energyReductionPct = oldKwh > 0 ? ((oldKwh - finalKwh) / oldKwh) * 100 : 0;
  const netPresentValue = npv(toNumber(assumptions.discountRatePct), annualNetSaving, years, totalCapex);
  const irr = simpleIrr(annualNetSaving, years, totalCapex);

  return {
    offer,
    product,
    quantity,
    oldWatt,
    oldKwh,
    postLedKwh,
    postCloKwh,
    finalKwh,
    oldEnergyCost,
    newEnergyCost,
    ledSaving,
    cloSaving,
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
    energyReductionPct,
    co2SavedTons,
    tenYearNetSavings,
    netPresentValue,
    irr,
    years,
  };
}

function buildRows(calc) {
  return Array.from({ length: calc.years }, (_, i) => {
    const year = i + 1;
    return {
      year,
      ledSaving: calc.ledSaving,
      cloSaving: calc.cloSaving,
      powerAidSaving: calc.powerAidSaving,
      maintenanceSaving: calc.maintenanceSaving,
      newOpex: calc.annualNewOpex,
      netSaving: calc.annualNetSaving,
      cumulativeNetSaving: calc.annualNetSaving * year,
    };
  });
}

export default function VimaluxLightingPortalV22() {
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
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, assumptions, project, adminMode, viewMode }));
  }, [products, assumptions, project, adminMode, viewMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedCalc = useMemo(() => calculateOffer(project, assumptions, products, project.selectedOffer), [project, assumptions, products]);
  const comparison = useMemo(() => offers.map((o) => calculateOffer(project, assumptions, products, o.id)), [project, assumptions, products]);
  const rows = useMemo(() => buildRows(selectedCalc), [selectedCalc]);
  const maxCumulative = Math.max(...rows.map((r) => r.cumulativeNetSaving), 1);
  const showAdminPanel = adminMode && viewMode === "admin";

  function updateProject(field, value) {
    setProject((prev) => ({ ...prev, [field]: value }));
  }

  function updateAssumption(field, value) {
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  }

  function updateProduct(id, field, value) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminMode(true);
      setViewMode("admin");
      setShowLogin(false);
      setAdminPassword("");
      setToast("Admin unlocked");
    } else setToast("Wrong admin password");
  }

  function logoutAdmin() {
    setAdminMode(false);
    setViewMode("customer");
    setShowLogin(false);
    setToast("Back to customer mode");
  }

  function addProduct() {
    const id = `custom_${Date.now()}`;
    setProducts((prev) => [...prev, { id, name: "Custom Luminaire", watt: 60, lumen: 10000, sellPrice: 150, buyPrice: 110, install: 35 }]);
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comparison.map(c => ({
      Offer: c.offer.title,
      Capex: c.totalCapex,
      Annual_Net_Saving: c.annualNetSaving,
      Payback_Years: c.paybackYears,
      Ten_Year_Net_Savings: c.tenYearNetSavings,
      NPV: c.netPresentValue,
      IRR: c.irr,
      LaaS_Month: c.laasMonthly,
      Energy_Reduction_Pct: c.energyReductionPct,
    }))), "Offer Comparison");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Selected Cashflow");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ ...project, product: selectedCalc.product.name, selectedOffer: selectedCalc.offer.title }]), "Project");
    if (adminMode) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    XLSX.writeFile(wb, `VIMALUX_${project.municipality || "proposal"}_V22.xlsx`);
  }

  function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 14, 22);
  }

  function footer(doc, page) {
    doc.setFontSize(8);
    doc.setTextColor(110, 118, 129);
    doc.text("VIMALUX – Smart Lighting / Smart City Infrastructure", 14, 287);
    doc.text(`Page ${page}`, 190, 287, { align: "right" });
  }

  function exportPdfProposal() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const municipality = project.municipality || "Municipality";
    const customer = project.customerName || "Customer";

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("VIMALUX", 14, 28);
    doc.setFontSize(20);
    doc.text("Smart Public Lighting Commercial Proposal", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Prepared for: ${customer}`, 14, 68);
    doc.text(`Municipality: ${municipality}`, 14, 76);
    doc.text(`Selected package: ${selectedCalc.offer.title}`, 14, 84);
    doc.text(`Date: ${project.proposalDate}`, 14, 92);
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.2);
    doc.line(14, 106, 196, 106);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Commercial summary", 14, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Annual net saving: ${euro(selectedCalc.annualNetSaving)}`, 14, 146);
    doc.text(`Payback: ${selectedCalc.paybackYears ? `${num(selectedCalc.paybackYears, 1)} years` : "N/A"}`, 14, 156);
    doc.text(`10-year net savings: ${euro(selectedCalc.tenYearNetSavings)}`, 14, 166);
    doc.text(`Energy reduction: ${pct(selectedCalc.energyReductionPct)}`, 14, 176);
    footer(doc, 1);

    doc.addPage();
    pdfHeader(doc, "1. Offer Comparison", "LED Only vs Smart CMS vs Smart + PowerAiD");
    autoTable(doc, {
      startY: 42,
      head: [["Offer", "Annual Net", "Payback", "10Y Net", "NPV", "IRR", "LaaS/month"]],
      body: comparison.map((c) => [c.offer.title, euro(c.annualNetSaving), c.paybackYears ? `${num(c.paybackYears, 1)} yrs` : "N/A", euro(c.tenYearNetSavings), euro(c.netPresentValue), c.irr ? pct(c.irr) : "N/A", euro(c.laasMonthly)]),
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });
    footer(doc, 2);

    doc.addPage();
    pdfHeader(doc, "2. Selected Value Stack", "Annual contribution by savings layer");
    autoTable(doc, {
      startY: 42,
      head: [["Layer", "Logic", "Annual value"]],
      body: [
        ["LED upgrade", `${num(assumptions.ledSavingPct)}% saving vs old baseline`, euro(selectedCalc.ledSaving)],
        ["CLO", selectedCalc.offer.smart ? `${num(assumptions.cloSavingPct)}% on post-LED consumption` : "Not included", euro(selectedCalc.cloSaving)],
        ["Maintenance", selectedCalc.offer.smart ? `${num(assumptions.maintenanceSavingPct)}% reduction assumption` : "Requires Smart CMS", euro(selectedCalc.maintenanceSaving)],
        ["PowerAiD", selectedCalc.offer.powerAid ? `${num(assumptions.powerAidAdditionalSavingPct)}% on post-LED+CLO load` : "Not included", euro(selectedCalc.powerAidSaving)],
        ["New OPEX", "CMS / PowerAiD recurring fees", `-${euro(selectedCalc.annualNewOpex)}`],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    });
    footer(doc, 3);

    doc.addPage();
    pdfHeader(doc, "3. Commercial Options", "Direct purchase, LaaS or financed structure");
    autoTable(doc, {
      startY: 42,
      head: [["Commercial metric", "Value"]],
      body: [
        ["Total CAPEX", euro(selectedCalc.totalCapex)],
        ["Investor value incl. margin", euro(selectedCalc.investorValue)],
        ["Indicative LaaS / month", euro(selectedCalc.laasMonthly)],
        ["NPV", euro(selectedCalc.netPresentValue)],
        ["IRR", selectedCalc.irr ? pct(selectedCalc.irr) : "N/A"],
        ["CO2 reduction / year", `${num(selectedCalc.co2SavedTons, 1)} t`],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    });
    footer(doc, 4);

    doc.addPage();
    pdfHeader(doc, "4. Why VIMALUX", "Smart lighting execution with financing logic");
    const bullets = [
      "LED-first business case with optional Smart value layers",
      "Smart CMS enables CLO, maintenance optimization and connectivity",
      "PowerAiD is only enabled where Smart connectivity exists",
      "Clear offer comparison for municipalities, ESCOs and investors",
      "Commercial structures suitable for CAPEX, LaaS and financed models",
    ];
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    bullets.forEach((b, i) => doc.text(`• ${b}`, 18, 48 + i * 12));
    doc.setFontSize(8);
    doc.text("Non-binding indication: figures are indicative and subject to technical validation, financing approval, final product selection, legal structure, credit assessment and site verification.", 14, 260, { maxWidth: 182 });
    footer(doc, 5);
    doc.save(`VIMALUX_${municipality}_V22_proposal.pdf`);
  }

  const selectedRows = rows;

  return (
    <div style={styles.page}>
      {toast && <div style={toast.toLowerCase().includes("wrong") ? styles.toastError : styles.toast}>{toast}</div>}
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <button style={styles.logoMark} onClick={() => setViewMode("customer")}>V</button>
            <div>
              <h1 style={styles.title}>VIMALUX Lighting AI Portal</h1>
              <p style={styles.subtitle}>Version 22 – Live Money Engine</p>
            </div>
          </div>
          <div style={styles.headerActions}>
            <button onClick={() => setViewMode("customer")} style={viewMode === "customer" ? styles.primaryButton : styles.secondaryButton}>Customer</button>
            {!adminMode && <button onClick={() => setShowLogin((v) => !v)} style={styles.secondaryButton}>Admin Login</button>}
            {adminMode && <button onClick={() => setViewMode("admin")} style={viewMode === "admin" ? styles.primaryButton : styles.secondaryButton}>Admin</button>}
            {adminMode && <button onClick={logoutAdmin} style={styles.ghostButton}>Logout</button>}
            <button onClick={exportPdfProposal} style={styles.primaryButton}>PDF Proposal</button>
            <button onClick={exportExcel} style={styles.secondaryButton}>Excel</button>
            <button onClick={resetAll} style={styles.ghostButton}>Reset</button>
          </div>
        </header>

        {showLogin && !adminMode && <section style={styles.loginBar}><input style={styles.loginInput} type="password" placeholder="Admin password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") unlockAdmin(); }} /><button onClick={unlockAdmin} style={styles.primaryButton}>Unlock</button></section>}

        <section style={styles.offerGrid}>
          {comparison.map((c) => <OfferCard key={c.offer.id} calc={c} selected={project.selectedOffer === c.offer.id} onSelect={() => updateProject("selectedOffer", c.offer.id)} />)}
        </section>

        <section style={styles.kpiGrid}>
          <Kpi label="Annual Net Saving" value={euro(selectedCalc.annualNetSaving)} note="after recurring OPEX" />
          <Kpi label="10Y Net Savings" value={euro(selectedCalc.tenYearNetSavings)} note="contract-period impact" />
          <Kpi label="Payback" value={selectedCalc.paybackYears ? `${num(selectedCalc.paybackYears, 1)} yrs` : "N/A"} note="simple payback" />
          <Kpi label="NPV" value={euro(selectedCalc.netPresentValue)} note={`${num(assumptions.discountRatePct, 1)}% discount rate`} />
          <Kpi label="IRR" value={selectedCalc.irr ? pct(selectedCalc.irr) : "N/A"} note="project cash yield" />
          <Kpi label="Energy Reduction" value={pct(selectedCalc.energyReductionPct)} note="selected package" />
          <Kpi label="CO₂ Saved / Year" value={`${num(selectedCalc.co2SavedTons, 1)} t`} note="assumption-based" />
          <Kpi label="LaaS / Month" value={euro(selectedCalc.laasMonthly)} note="indicative service price" />
        </section>

        <section style={styles.mainGrid}>
          <div style={styles.cardLarge}>
            <SectionTitle title="Project Input" sub="Customer-facing assumptions" />
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
              <Toggle label="Installation included" checked={project.includeInstallation} onChange={(v) => updateProject("includeInstallation", v)} />
              <Toggle label="Maintenance saving" checked={project.includeMaintenance} onChange={(v) => updateProject("includeMaintenance", v)} />
            </div>
            <label style={styles.field}><span style={styles.label}>Notes</span><textarea style={styles.textarea} value={project.notes} onChange={(e) => updateProject("notes", e.target.value)} /></label>
          </div>

          <div style={styles.card}>
            <SectionTitle title="Selected Value Stack" sub={selectedCalc.offer.title} />
            <ValueLine label="LED energy saving" value={selectedCalc.ledSaving} max={selectedCalc.annualGrossSaving} />
            <ValueLine label="CLO saving" value={selectedCalc.cloSaving} max={selectedCalc.annualGrossSaving} />
            <ValueLine label="PowerAiD saving" value={selectedCalc.powerAidSaving} max={selectedCalc.annualGrossSaving} />
            <ValueLine label="Maintenance saving" value={selectedCalc.maintenanceSaving} max={selectedCalc.annualGrossSaving} />
            <ValueLine label="New OPEX" value={-selectedCalc.annualNewOpex} max={selectedCalc.annualGrossSaving} negative />
          </div>
        </section>

        {showAdminPanel && <section style={styles.twoGrid}><div style={styles.card}><SectionTitle title="Admin Assumptions" sub="EU decimal input accepted" /><div style={styles.formGrid}>{Object.entries(assumptions).map(([key, value]) => <Input key={key} label={key} type="number" value={value} onChange={(v) => updateAssumption(key, v)} />)}</div></div><div style={styles.card}><div style={styles.cardTop}><SectionTitle title="Product Override" sub="Protected catalogue editing" /><span style={styles.adminOn}>Admin</span></div><div style={styles.stack}><div style={styles.buttonRow}><button onClick={addProduct} style={styles.primaryButton}>Add Product</button><button onClick={() => setProducts(defaultProducts)} style={styles.secondaryButton}>Reset Products</button></div><ProductTable products={products} updateProduct={updateProduct} /></div></div></section>}

        <section style={styles.card}>
          <SectionTitle title="Customer Benefit Curve" sub="Accumulated annual net savings" />
          <div style={styles.chartBox}>{selectedRows.map((r) => <div key={r.year} style={styles.chartRow}><span style={styles.chartYear}>{r.year}</span><div style={styles.barTrack}><div style={{ ...styles.barFill, width: `${Math.max(4, (r.cumulativeNetSaving / maxCumulative) * 100)}%` }} /></div><span style={styles.chartValue}>{euro(r.cumulativeNetSaving)}</span></div>)}</div>
        </section>

        {showAdminPanel && <section style={styles.card}><SectionTitle title="Admin Cashflow Detail" sub="Internal calculation split" /><div style={styles.tableWrap}><table style={styles.table}><thead><tr><Th left>Year</Th><Th>LED</Th><Th>CLO</Th><Th>PowerAiD</Th><Th>Maintenance</Th><Th>OPEX</Th><Th>Net</Th><Th>Cumulative</Th></tr></thead><tbody>{selectedRows.map((r) => <tr key={r.year} style={styles.tr}><Td left>{r.year}</Td><Td>{euro(r.ledSaving)}</Td><Td>{euro(r.cloSaving)}</Td><Td>{euro(r.powerAidSaving)}</Td><Td>{euro(r.maintenanceSaving)}</Td><Td>{euro(r.newOpex)}</Td><Td strong>{euro(r.netSaving)}</Td><Td strong>{euro(r.cumulativeNetSaving)}</Td></tr>)}</tbody></table></div></section>}
      </div>
    </div>
  );
}

function OfferCard({ calc, selected, onSelect }) {
  return <button onClick={onSelect} style={selected ? styles.offerCardSelected : styles.offerCard}><div style={styles.offerTop}><span style={styles.offerTitle}>{calc.offer.title}</span><span style={styles.offerBadge}>{calc.offer.badge}</span></div><p style={styles.offerSub}>{calc.offer.positioning}</p><div style={styles.offerMetrics}><div><small>Payback</small><b>{calc.paybackYears ? `${num(calc.paybackYears, 1)} yrs` : "N/A"}</b></div><div><small>10Y Net</small><b>{euro(calc.tenYearNetSavings)}</b></div></div></button>;
}
function SectionTitle({ title, sub }) { return <div><h2 style={styles.sectionTitle}>{title}</h2><p style={styles.sectionSub}>{sub}</p></div>; }
function Kpi({ label, value, note }) { return <div style={styles.kpiCard}><div style={styles.kpiLabel}>{label}</div><div style={styles.kpiValue}>{value}</div><div style={styles.kpiNote}>{note}</div></div>; }
function Input({ label, value, onChange, type = "text" }) { return <label style={styles.field}><span style={styles.label}>{label}</span><input style={styles.input} type={type === "number" ? "text" : type} inputMode={type === "number" ? "decimal" : undefined} value={type === "number" ? inputNumber(value) : value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Toggle({ label, checked, onChange }) { return <label style={styles.toggle}><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>; }
function Th({ children, left }) { return <th style={left ? styles.thLeft : styles.thRight}>{children}</th>; }
function Td({ children, left, strong }) { return <td style={left ? styles.tdLeft : strong ? styles.tdStrong : styles.tdRight}>{children}</td>; }
function ValueLine({ label, value, max, negative }) { const abs = Math.abs(toNumber(value)); const pctWidth = Math.max(4, Math.min(100, (abs / Math.max(1, toNumber(max))) * 100)); return <div style={styles.valueLine}><div style={styles.valueLineTop}><span>{label}</span><b>{negative ? `-${euro(abs)}` : euro(abs)}</b></div><div style={styles.valueTrack}><div style={{ ...styles.valueFill, background: negative ? "#ef4444" : "linear-gradient(90deg,#2563eb,#60a5fa)", width: `${pctWidth}%` }} /></div></div>; }
function ProductTable({ products, updateProduct }) { return <div style={styles.tableWrapSmall}><table style={styles.table}><thead><tr><Th left>Name</Th><Th>W</Th><Th>lm</Th><Th>Sell</Th><Th>Buy</Th><Th>Install</Th></tr></thead><tbody>{products.map((p) => <tr key={p.id} style={styles.tr}><td style={styles.tdLeft}><input style={styles.adminInputWide} value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} /></td>{["watt", "lumen", "sellPrice", "buyPrice", "install"].map((field) => <td key={field} style={styles.tdRight}><input style={styles.adminInput} value={inputNumber(p[field])} inputMode="decimal" onChange={(e) => updateProduct(p.id, field, e.target.value)} /></td>)}</tr>)}</tbody></table></div>; }

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb", color: "#0f172a", padding: 24, fontFamily: "Inter, Segoe UI, Arial, sans-serif" },
  shell: { maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", padding: 18, border: "1px solid #e2e8f0", borderRadius: 24, background: "#fff", boxShadow: "0 10px 28px rgba(15,23,42,.06)", flexWrap: "wrap" },
  brandRow: { display: "flex", gap: 14, alignItems: "center" },
  logoMark: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 24, border: 0, cursor: "pointer" },
  title: { margin: 0, fontSize: 32, letterSpacing: "-0.035em", fontWeight: 850 },
  subtitle: { margin: "5px 0 0", color: "#64748b", fontSize: 14 },
  headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  primaryButton: { border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  ghostButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  loginBar: { display: "flex", gap: 10, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  loginInput: { width: 280, border: "1px solid #cbd5e1", borderRadius: 14, padding: "11px 13px" },
  toast: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#16a34a", color: "#fff", borderRadius: 14, padding: "12px 16px" },
  toastError: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#dc2626", color: "#fff", borderRadius: 14, padding: "12px 16px" },
  offerGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 },
  offerCard: { textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, cursor: "pointer", boxShadow: "0 10px 28px rgba(15,23,42,.05)" },
  offerCardSelected: { textAlign: "left", background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 22, padding: 17, cursor: "pointer", boxShadow: "0 10px 28px rgba(37,99,235,.12)" },
  offerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  offerTitle: { fontSize: 21, fontWeight: 900 },
  offerBadge: { background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 },
  offerSub: { color: "#64748b", margin: "8px 0 16px" },
  offerMetrics: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 },
  kpiCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 10px 28px rgba(15,23,42,.06)" },
  kpiLabel: { color: "#64748b", fontSize: 13, fontWeight: 800 },
  kpiValue: { fontSize: 29, lineHeight: 1.15, marginTop: 8, fontWeight: 900, letterSpacing: "-0.04em" },
  kpiNote: { color: "#94a3b8", fontSize: 12, marginTop: 7 },
  mainGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 },
  twoGrid: { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 24 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 28px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", gap: 18 },
  cardLarge: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 28px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", gap: 18 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  sectionTitle: { margin: 0, fontSize: 23, fontWeight: 850, letterSpacing: "-0.025em" },
  sectionSub: { margin: "5px 0 0", color: "#64748b", fontSize: 13 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 15 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#334155", fontSize: 13, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  textarea: { width: "100%", minHeight: 104, boxSizing: "border-box", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #cbd5e1", background: "#f8fafc", padding: "12px 13px", borderRadius: 15, fontWeight: 750 },
  valueLine: { display: "flex", flexDirection: "column", gap: 7 },
  valueLineTop: { display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 800 },
  valueTrack: { height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  valueFill: { height: "100%", borderRadius: 999 },
  chartBox: { display: "flex", flexDirection: "column", gap: 11 },
  chartRow: { display: "grid", gridTemplateColumns: "28px 1fr 95px", gap: 10, alignItems: "center" },
  chartYear: { color: "#475569", fontWeight: 800 },
  barTrack: { height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#2563eb,#60a5fa)", borderRadius: 999 },
  chartValue: { textAlign: "right", fontWeight: 800, fontSize: 12 },
  tableWrap: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 },
  tableWrapSmall: { overflowX: "auto", maxHeight: 390, border: "1px solid #e2e8f0", borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  thLeft: { textAlign: "left", background: "#f8fafc", color: "#64748b", padding: 12, whiteSpace: "nowrap" },
  thRight: { textAlign: "right", background: "#f8fafc", color: "#64748b", padding: 12, whiteSpace: "nowrap" },
  tr: { borderTop: "1px solid #e2e8f0" },
  tdLeft: { textAlign: "left", padding: 12, whiteSpace: "nowrap" },
  tdRight: { textAlign: "right", padding: 12, whiteSpace: "nowrap" },
  tdStrong: { textAlign: "right", padding: 12, whiteSpace: "nowrap", fontWeight: 900 },
  adminInput: { width: 92, textAlign: "right", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 9px" },
  adminInputWide: { width: 205, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 9px" },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  adminOn: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800 },
};
