import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 13 – FINAL STABLE MERGE
   Focus:
   - Admin mode
   - Product override
   - PDF proposal
   - LocalStorage persistence
   - Safer calculations
===================================================== */

/* =========================
   DEFAULT PRODUCT CATALOGUE
========================= */
const defaultProducts = [
  {
    id: "urban45",
    name: "VIMALUX Urban 45",
    category: "Urban",
    watt: 45,
    lumen: 7650,
    sellPrice: 135,
    buyPrice: 95,
    install: 35,
    smartReady: true,
  },
  {
    id: "street60",
    name: "VIMALUX Street 60",
    category: "Street",
    watt: 60,
    lumen: 10200,
    sellPrice: 155,
    buyPrice: 110,
    install: 35,
    smartReady: true,
  },
  {
    id: "road90",
    name: "VIMALUX Road 90",
    category: "Road",
    watt: 90,
    lumen: 15300,
    sellPrice: 210,
    buyPrice: 150,
    install: 40,
    smartReady: true,
  },
  {
    id: "highway120",
    name: "VIMALUX Highway 120",
    category: "Highway",
    watt: 120,
    lumen: 20400,
    sellPrice: 285,
    buyPrice: 205,
    install: 45,
    smartReady: true,
  },
];

/* =========================
   CONSTANTS
========================= */
const STORAGE_KEY = "vimalux_app_v13_state";
const ADMIN_PASSWORD = "vimalux-admin";

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
  proposalYears: 10,
  financingMarginPct: 8,
  vatPct: 22,
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

/* =========================
   HELPERS
========================= */
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function euro(value, decimals = 0) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
}

function pct(value) {
  return `${toNumber(value).toFixed(1)}%`;
}

function cloneProducts(products) {
  return products.map((p) => ({ ...p }));
}

function safeProduct(products, selectedProductId) {
  return products.find((p) => p.id === selectedProductId) || products[0] || defaultProducts[0];
}

function calculateProject(project, assumptions, products) {
  const product = safeProduct(products, project.selectedProductId);
  const quantity = Math.max(0, toNumber(project.quantity));
  const oldWatt = Math.max(0, toNumber(project.existingWatt));
  const newWatt = Math.max(0, toNumber(product.watt));
  const hours = Math.max(0, toNumber(assumptions.burningHours));
  const energyPrice = Math.max(0, toNumber(assumptions.energyPrice));
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));

  const oldKwh = (quantity * oldWatt * hours) / 1000;
  const ledKwh = (quantity * newWatt * hours) / 1000;

  const smartSavingPct = project.includeSmart ? toNumber(assumptions.smartDimmingSavingPct) / 100 : 0;
  const cloSavingPct = project.includeSmart ? toNumber(assumptions.cloSavingPct) / 100 : 0;
  const combinedSmartFactor = Math.max(0, 1 - smartSavingPct - cloSavingPct);
  const smartKwh = ledKwh * combinedSmartFactor;

  const finalKwh = project.includeSmart ? smartKwh : ledKwh;

  const oldEnergyCost = oldKwh * energyPrice;
  const newEnergyCost = finalKwh * energyPrice;
  const energySaving = Math.max(0, oldEnergyCost - newEnergyCost);

  const oldMaintenance = quantity * toNumber(assumptions.maintenanceOldPerLamp);
  const maintenanceSaving = project.includeMaintenance
    ? oldMaintenance * (toNumber(assumptions.maintenanceSavingPct) / 100)
    : 0;

  const annualGrossSaving = energySaving + maintenanceSaving;

  const luminaireCapex = quantity * toNumber(product.sellPrice);
  const installationCapex = project.includeInstallation ? quantity * toNumber(product.install) : 0;
  const smartCapex = project.includeSmart ? quantity * toNumber(assumptions.smartNodeCost) : 0;
  const totalCapex = luminaireCapex + installationCapex + smartCapex;

  const cmsOpex = project.includeSmart ? quantity * toNumber(assumptions.cmsFeePerLampYear) : 0;
  const powerAidOpex = project.includePowerAid ? quantity * toNumber(assumptions.powerAidFeePerLampYear) : 0;
  const annualNewOpex = cmsOpex + powerAidOpex;

  const annualNetSaving = annualGrossSaving - annualNewOpex;
  const paybackYears = annualNetSaving > 0 ? totalCapex / annualNetSaving : null;

  const contractValue = annualNetSaving * years;
  const financingMargin = totalCapex * (toNumber(assumptions.financingMarginPct) / 100);
  const suggestedLaaSAnnual = years > 0 ? (totalCapex + financingMargin) / years + annualNewOpex : 0;
  const suggestedLaaSMonthly = suggestedLaaSAnnual / 12;

  const buyCost = quantity * toNumber(product.buyPrice);
  const hardwareMargin = luminaireCapex - buyCost;

  return {
    product,
    quantity,
    oldWatt,
    newWatt,
    oldKwh,
    ledKwh,
    finalKwh,
    oldEnergyCost,
    newEnergyCost,
    energySaving,
    oldMaintenance,
    maintenanceSaving,
    annualGrossSaving,
    cmsOpex,
    powerAidOpex,
    annualNewOpex,
    annualNetSaving,
    luminaireCapex,
    installationCapex,
    smartCapex,
    totalCapex,
    contractValue,
    suggestedLaaSAnnual,
    suggestedLaaSMonthly,
    paybackYears,
    hardwareMargin,
    financingMargin,
    energyReductionPct: oldKwh > 0 ? ((oldKwh - finalKwh) / oldKwh) * 100 : 0,
  };
}

function buildYearRows(calc, project, assumptions) {
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));
  const rows = [];
  for (let y = 1; y <= years; y += 1) {
    rows.push({
      year: y,
      oldEnergyCost: calc.oldEnergyCost,
      newEnergyCost: calc.newEnergyCost,
      energySaving: calc.energySaving,
      maintenanceSaving: calc.maintenanceSaving,
      newOpex: calc.annualNewOpex,
      netSaving: calc.annualNetSaving,
      cumulativeNetSaving: calc.annualNetSaving * y,
    });
  }
  return rows;
}

/* =========================
   MAIN COMPONENT
========================= */
export default function VimaluxLightingPortalV13() {
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [products, setProducts] = useState(() => cloneProducts(defaultProducts));
  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [project, setProject] = useState(emptyProject);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.assumptions) setAssumptions({ ...defaultAssumptions, ...parsed.assumptions });
      if (parsed.project) setProject({ ...emptyProject, ...parsed.project });
    } catch (error) {
      console.warn("Could not load saved VIMALUX state", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ products, assumptions, project })
      );
    } catch (error) {
      console.warn("Could not save VIMALUX state", error);
    }
  }, [products, assumptions, project]);

  const calc = useMemo(
    () => calculateProject(project, assumptions, products),
    [project, assumptions, products]
  );

  const yearRows = useMemo(
    () => buildYearRows(calc, project, assumptions),
    [calc, project, assumptions]
  );

  function updateProject(field, value) {
    setProject((prev) => ({ ...prev, [field]: value }));
  }

  function updateAssumption(field, value) {
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  }

  function updateProduct(id, field, value) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: ["name", "category", "id"].includes(field) ? value : toNumber(value),
            }
          : p
      )
    );
  }

  function addProduct() {
    const id = `custom_${Date.now()}`;
    setProducts((prev) => [
      ...prev,
      {
        id,
        name: "Custom Luminaire",
        category: "Custom",
        watt: 60,
        lumen: 10000,
        sellPrice: 150,
        buyPrice: 110,
        install: 35,
        smartReady: true,
      },
    ]);
    updateProject("selectedProductId", id);
  }

  function resetProducts() {
    setProducts(cloneProducts(defaultProducts));
    updateProject("selectedProductId", "street60");
    setStatus("Product catalogue reset to default.");
  }

  function loginAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminMode(true);
      setAdminPassword("");
      setStatus("Admin mode enabled.");
    } else {
      setStatus("Wrong admin password.");
    }
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    const summary = [
      ["Customer", project.customerName],
      ["Municipality", project.municipality],
      ["Country", project.country],
      ["Selected product", calc.product.name],
      ["Quantity", calc.quantity],
      ["Existing watt", calc.oldWatt],
      ["New watt", calc.newWatt],
      ["Energy price", assumptions.energyPrice],
      ["Annual net saving", calc.annualNetSaving],
      ["Total CAPEX", calc.totalCapex],
      ["Payback years", calc.paybackYears || "N/A"],
      ["Suggested LaaS monthly", calc.suggestedLaaSMonthly],
    ];

    const annual = yearRows.map((r) => ({
      Year: r.year,
      "Old energy cost": r.oldEnergyCost,
      "New energy cost": r.newEnergyCost,
      "Energy saving": r.energySaving,
      "Maintenance saving": r.maintenanceSaving,
      "New OPEX": r.newOpex,
      "Net saving": r.netSaving,
      "Cumulative net saving": r.cumulativeNetSaving,
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annual), "Cashflow");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    XLSX.writeFile(wb, `VIMALUX_${project.municipality || "proposal"}.xlsx`);
  }

  function exportPdfProposal() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("VIMALUX Smart Lighting Proposal", 14, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${project.proposalDate}`, 14, 26);
    doc.text(`Customer: ${project.customerName || "-"}`, 14, 32);
    doc.text(`Municipality: ${project.municipality || "-"}`, 14, 38);
    doc.text(`Country: ${project.country || "-"}`, 14, 44);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Executive Summary", 14, 56);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryText = [
      `This proposal covers ${calc.quantity} public lighting points with ${calc.product.name}.`,
      `The estimated annual net saving is ${euro(calc.annualNetSaving)} after software and service costs.`,
      `The estimated CAPEX is ${euro(calc.totalCapex)} with a simple payback of ${calc.paybackYears ? calc.paybackYears.toFixed(1) + " years" : "N/A"}.`,
      `The estimated energy reduction is ${pct(calc.energyReductionPct)} compared with the current baseline.`,
    ].join(" ");

    doc.text(doc.splitTextToSize(summaryText, pageWidth - 28), 14, 64);

    autoTable(doc, {
      startY: 84,
      head: [["Parameter", "Value"]],
      body: [
        ["Selected luminaire", calc.product.name],
        ["Quantity", calc.quantity.toLocaleString()],
        ["Existing wattage", `${calc.oldWatt} W`],
        ["New wattage", `${calc.newWatt} W`],
        ["Energy price", `${euro(assumptions.energyPrice, 2)} / kWh`],
        ["Burning hours", `${assumptions.burningHours} h/year`],
        ["Smart control", project.includeSmart ? "Included" : "Not included"],
        ["PowerAiD", project.includePowerAid ? "Included" : "Not included"],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Financial Item", "Amount"]],
      body: [
        ["Annual old energy cost", euro(calc.oldEnergyCost)],
        ["Annual new energy cost", euro(calc.newEnergyCost)],
        ["Annual energy saving", euro(calc.energySaving)],
        ["Annual maintenance saving", euro(calc.maintenanceSaving)],
        ["Annual CMS / software OPEX", euro(calc.cmsOpex)],
        ["Annual PowerAiD OPEX", euro(calc.powerAidOpex)],
        ["Annual net saving", euro(calc.annualNetSaving)],
        ["Total CAPEX", euro(calc.totalCapex)],
        ["Suggested LaaS monthly", euro(calc.suggestedLaaSMonthly)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Year", "Net Saving", "Cumulative Net Saving"]],
      body: yearRows.map((r) => [r.year, euro(r.netSaving), euro(r.cumulativeNetSaving)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    const disclaimerY = Math.min(doc.lastAutoTable.finalY + 10, 270);
    if (disclaimerY > 250) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Non-binding indication", 14, doc.lastAutoTable.finalY + 10 > 250 ? 18 : disclaimerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const disclaimer =
      "The calculations in this document are indicative and non-binding. Final pricing, financing, technical design, lighting class validation, installation costs, credit approval and contractual structure are subject to due diligence, site verification, final product selection and approval by the relevant parties.";
    const y = doc.lastAutoTable.finalY + 16 > 256 ? 24 : disclaimerY + 6;
    doc.text(doc.splitTextToSize(disclaimer, pageWidth - 28), 14, y);

    doc.save(`VIMALUX_${project.municipality || "proposal"}.pdf`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>VIMALUX Lighting AI Portal</h1>
            <p style={styles.subtitle}>Version 13 – Admin Product Override + PDF Proposal</p>
          </div>

          <div style={styles.buttonRow}>
            <button onClick={exportPdfProposal} style={styles.primaryButton}>
              Export PDF Proposal
            </button>
            <button onClick={exportExcel} style={styles.secondaryButton}>
              Export Excel
            </button>
          </div>
        </header>

        {status && (
          <div style={styles.statusBox}>
            {status}
          </div>
        )}

        <section style={styles.grid3}>
          <div style={styles.cardWide}>
            <h2 style={styles.sectionTitle}>Project Input</h2>
            <div style={styles.formGrid}>
              <Input label="Customer" value={project.customerName} onChange={(v) => updateProject("customerName", v)} />
              <Input label="Municipality" value={project.municipality} onChange={(v) => updateProject("municipality", v)} />
              <Input label="Country" value={project.country} onChange={(v) => updateProject("country", v)} />
              <Input label="Contact person" value={project.contactPerson} onChange={(v) => updateProject("contactPerson", v)} />
              <Input label="Proposal date" type="date" value={project.proposalDate} onChange={(v) => updateProject("proposalDate", v)} />
              <Input label="Quantity" type="number" value={project.quantity} onChange={(v) => updateProject("quantity", toNumber(v))} />
              <Input label="Existing wattage" type="number" value={project.existingWatt} onChange={(v) => updateProject("existingWatt", toNumber(v))} />

              <label style={styles.field}>
                <span style={styles.label}>Product</span>
                <select
                  style={styles.input}
                  value={project.selectedProductId}
                  onChange={(e) => updateProject("selectedProductId", e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} – {p.watt}W – {euro(p.sellPrice)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={styles.toggleGrid}>
              <Toggle label="Smart CMS" checked={project.includeSmart} onChange={(v) => updateProject("includeSmart", v)} />
              <Toggle label="PowerAiD" checked={project.includePowerAid} onChange={(v) => updateProject("includePowerAid", v)} />
              <Toggle label="Installation" checked={project.includeInstallation} onChange={(v) => updateProject("includeInstallation", v)} />
              <Toggle label="Maintenance saving" checked={project.includeMaintenance} onChange={(v) => updateProject("includeMaintenance", v)} />
            </div>

            <label style={styles.field}>
              <span style={styles.label}>Notes</span>
              <textarea
                style={styles.textarea}
                value={project.notes}
                onChange={(e) => updateProject("notes", e.target.value)}
              />
            </label>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Result</h2>
            <Metric label="Annual net saving" value={euro(calc.annualNetSaving)} />
            <Metric label="Total CAPEX" value={euro(calc.totalCapex)} />
            <Metric label="Payback" value={calc.paybackYears ? `${calc.paybackYears.toFixed(1)} years` : "N/A"} />
            <Metric label="Energy reduction" value={pct(calc.energyReductionPct)} />
            <Metric label="Suggested LaaS monthly" value={euro(calc.suggestedLaaSMonthly)} />
          </div>
        </section>

        <section style={styles.grid2}>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Assumptions</h2>
            <div style={styles.formGrid}>
              {Object.entries(assumptions).map(([key, value]) => (
                <Input
                  key={key}
                  label={key}
                  type="number"
                  value={value}
                  onChange={(v) => updateAssumption(key, toNumber(v))}
                />
              ))}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.adminHeader}>
              <h2 style={styles.sectionTitle}>Admin Mode</h2>
              {adminMode && <span style={styles.badge}>Enabled</span>}
            </div>

            {!adminMode ? (
              <div style={styles.buttonRow}>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <button onClick={loginAdmin} style={styles.primaryButton}>
                  Unlock
                </button>
              </div>
            ) : (
              <div style={styles.stack}>
                <div style={styles.buttonRow}>
                  <button onClick={addProduct} style={styles.primaryButton}>
                    Add Product
                  </button>
                  <button onClick={resetProducts} style={styles.secondaryButton}>
                    Reset Products
                  </button>
                  <button onClick={() => setAdminMode(false)} style={styles.secondaryButton}>
                    Lock
                  </button>
                </div>

                <div style={styles.tableWrapSmall}>
                  <table style={styles.table}>
                    <thead style={styles.tableHead}>
                      <tr>
                        <th style={styles.thLeft}>Name</th>
                        <th style={styles.thRight}>W</th>
                        <th style={styles.thRight}>lm</th>
                        <th style={styles.thRight}>Sell</th>
                        <th style={styles.thRight}>Buy</th>
                        <th style={styles.thRight}>Install</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} style={styles.tr}>
                          <td style={styles.td}>
                            <input style={styles.adminInputWide} value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} />
                          </td>
                          <AdminCell value={p.watt} onChange={(v) => updateProduct(p.id, "watt", v)} />
                          <AdminCell value={p.lumen} onChange={(v) => updateProduct(p.id, "lumen", v)} />
                          <AdminCell value={p.sellPrice} onChange={(v) => updateProduct(p.id, "sellPrice", v)} />
                          <AdminCell value={p.buyPrice} onChange={(v) => updateProduct(p.id, "buyPrice", v)} />
                          <AdminCell value={p.install} onChange={(v) => updateProduct(p.id, "install", v)} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>10-Year Cashflow Preview</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead style={styles.tableHead}>
                <tr>
                  <th style={styles.thLeft}>Year</th>
                  <th style={styles.thRight}>Old energy</th>
                  <th style={styles.thRight}>New energy</th>
                  <th style={styles.thRight}>Energy saving</th>
                  <th style={styles.thRight}>Maintenance saving</th>
                  <th style={styles.thRight}>New OPEX</th>
                  <th style={styles.thRight}>Net saving</th>
                  <th style={styles.thRight}>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.year} style={styles.tr}>
                    <td style={styles.td}>{r.year}</td>
                    <td style={styles.tdRight}>{euro(r.oldEnergyCost)}</td>
                    <td style={styles.tdRight}>{euro(r.newEnergyCost)}</td>
                    <td style={styles.tdRight}>{euro(r.energySaving)}</td>
                    <td style={styles.tdRight}>{euro(r.maintenanceSaving)}</td>
                    <td style={styles.tdRight}>{euro(r.newOpex)}</td>
                    <td style={styles.tdRightStrong}>{euro(r.netSaving)}</td>
                    <td style={styles.tdRightStrong}>{euro(r.cumulativeNetSaving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

/* =========================
   UI COMPONENTS
========================= */
const styles = {
  page: { minHeight: "100vh", background: "#0a0a0a", color: "#f5f5f5", padding: 24, fontFamily: "Inter, Arial, sans-serif" },
  container: { maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { fontSize: 34, lineHeight: 1.1, margin: 0, fontWeight: 800 },
  subtitle: { color: "#a3a3a3", marginTop: 8 },
  buttonRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  primaryButton: { padding: "10px 14px", borderRadius: 12, border: "1px solid #fff", background: "#fff", color: "#000", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { padding: "10px 14px", borderRadius: 12, border: "1px solid #404040", background: "#262626", color: "#fff", cursor: "pointer" },
  statusBox: { border: "1px solid #404040", background: "#171717", borderRadius: 12, padding: 12, color: "#d4d4d4" },
  grid3: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: { border: "1px solid #262626", background: "#171717", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  cardWide: { border: "1px solid #262626", background: "#171717", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  sectionTitle: { fontSize: 22, margin: 0, fontWeight: 700 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#a3a3a3" },
  input: { width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1px solid #404040", background: "#0a0a0a", color: "#fff", padding: "10px 12px" },
  textarea: { width: "100%", minHeight: 90, boxSizing: "border-box", borderRadius: 12, border: "1px solid #404040", background: "#0a0a0a", color: "#fff", padding: "10px 12px" },
  metric: { background: "#0a0a0a", border: "1px solid #262626", borderRadius: 14, padding: 16 },
  metricValue: { fontSize: 26, fontWeight: 800, marginTop: 4 },
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  badge: { fontSize: 12, padding: "4px 8px", borderRadius: 999, background: "#14532d", color: "#bbf7d0" },
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  tableWrap: { overflowX: "auto" },
  tableWrapSmall: { overflowX: "auto", maxHeight: 380, border: "1px solid #262626", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  tableHead: { background: "#0a0a0a", color: "#a3a3a3", borderBottom: "1px solid #262626" },
  thLeft: { textAlign: "left", padding: 10, whiteSpace: "nowrap" },
  thRight: { textAlign: "right", padding: 10, whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #262626" },
  td: { padding: 10 },
  tdRight: { padding: 10, textAlign: "right" },
  tdRightStrong: { padding: 10, textAlign: "right", fontWeight: 700 },
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderRadius: 12, border: "1px solid #262626", background: "#0a0a0a", padding: "10px 12px" },
  toggleLabel: { fontSize: 14, color: "#d4d4d4" },
  adminInput: { width: 90, textAlign: "right", borderRadius: 8, border: "1px solid #404040", background: "#0a0a0a", color: "#fff", padding: "6px 8px" },
  adminInputWide: { width: 180, borderRadius: 8, border: "1px solid #404040", background: "#0a0a0a", color: "#fff", padding: "6px 8px" },
};

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={styles.toggle}>
      <span style={styles.toggleLabel}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <div style={styles.label}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function AdminCell({ value, onChange }) {
  return (
    <td style={styles.tdRight}>
      <input
        style={styles.adminInput}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}
