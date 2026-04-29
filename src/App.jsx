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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">VIMALUX Lighting AI Portal</h1>
            <p className="text-neutral-400">Version 13 – Admin Product Override + PDF Proposal</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={exportPdfProposal} className="px-4 py-2 rounded-xl bg-white text-black font-semibold">
              Export PDF Proposal
            </button>
            <button onClick={exportExcel} className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700">
              Export Excel
            </button>
          </div>
        </header>

        {status && (
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            {status}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <h2 className="text-xl font-semibold">Project Input</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Customer" value={project.customerName} onChange={(v) => updateProject("customerName", v)} />
              <Input label="Municipality" value={project.municipality} onChange={(v) => updateProject("municipality", v)} />
              <Input label="Country" value={project.country} onChange={(v) => updateProject("country", v)} />
              <Input label="Contact person" value={project.contactPerson} onChange={(v) => updateProject("contactPerson", v)} />
              <Input label="Proposal date" type="date" value={project.proposalDate} onChange={(v) => updateProject("proposalDate", v)} />
              <Input label="Quantity" type="number" value={project.quantity} onChange={(v) => updateProject("quantity", toNumber(v))} />
              <Input label="Existing wattage" type="number" value={project.existingWatt} onChange={(v) => updateProject("existingWatt", toNumber(v))} />

              <label className="space-y-1">
                <span className="text-sm text-neutral-400">Product</span>
                <select
                  className="w-full rounded-xl bg-neutral-950 border border-neutral-700 px-3 py-2"
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <Toggle label="Smart CMS" checked={project.includeSmart} onChange={(v) => updateProject("includeSmart", v)} />
              <Toggle label="PowerAiD" checked={project.includePowerAid} onChange={(v) => updateProject("includePowerAid", v)} />
              <Toggle label="Installation" checked={project.includeInstallation} onChange={(v) => updateProject("includeInstallation", v)} />
              <Toggle label="Maintenance saving" checked={project.includeMaintenance} onChange={(v) => updateProject("includeMaintenance", v)} />
            </div>

            <label className="space-y-1 block">
              <span className="text-sm text-neutral-400">Notes</span>
              <textarea
                className="w-full min-h-24 rounded-xl bg-neutral-950 border border-neutral-700 px-3 py-2"
                value={project.notes}
                onChange={(e) => updateProject("notes", e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <h2 className="text-xl font-semibold">Result</h2>
            <Metric label="Annual net saving" value={euro(calc.annualNetSaving)} />
            <Metric label="Total CAPEX" value={euro(calc.totalCapex)} />
            <Metric label="Payback" value={calc.paybackYears ? `${calc.paybackYears.toFixed(1)} years` : "N/A"} />
            <Metric label="Energy reduction" value={pct(calc.energyReductionPct)} />
            <Metric label="Suggested LaaS monthly" value={euro(calc.suggestedLaaSMonthly)} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <h2 className="text-xl font-semibold">Assumptions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Admin Mode</h2>
              {adminMode && <span className="text-xs px-2 py-1 rounded-full bg-green-900 text-green-200">Enabled</span>}
            </div>

            {!adminMode ? (
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-neutral-950 border border-neutral-700 px-3 py-2"
                  type="password"
                  placeholder="Admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <button onClick={loginAdmin} className="px-4 py-2 rounded-xl bg-neutral-100 text-black font-semibold">
                  Unlock
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={addProduct} className="px-4 py-2 rounded-xl bg-neutral-100 text-black font-semibold">
                    Add Product
                  </button>
                  <button onClick={resetProducts} className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700">
                    Reset Products
                  </button>
                  <button onClick={() => setAdminMode(false)} className="px-4 py-2 rounded-xl bg-neutral-800 border border-neutral-700">
                    Lock
                  </button>
                </div>

                <div className="overflow-auto max-h-96 border border-neutral-800 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-950 text-neutral-400 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-right p-2">W</th>
                        <th className="text-right p-2">lm</th>
                        <th className="text-right p-2">Sell</th>
                        <th className="text-right p-2">Buy</th>
                        <th className="text-right p-2">Install</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-t border-neutral-800">
                          <td className="p-2">
                            <input className="w-48 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1" value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} />
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

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <h2 className="text-xl font-semibold">10-Year Cashflow Preview</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="text-left py-2">Year</th>
                  <th className="text-right py-2">Old energy</th>
                  <th className="text-right py-2">New energy</th>
                  <th className="text-right py-2">Energy saving</th>
                  <th className="text-right py-2">Maintenance saving</th>
                  <th className="text-right py-2">New OPEX</th>
                  <th className="text-right py-2">Net saving</th>
                  <th className="text-right py-2">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.year} className="border-b border-neutral-800">
                    <td className="py-2">{r.year}</td>
                    <td className="text-right">{euro(r.oldEnergyCost)}</td>
                    <td className="text-right">{euro(r.newEnergyCost)}</td>
                    <td className="text-right">{euro(r.energySaving)}</td>
                    <td className="text-right">{euro(r.maintenanceSaving)}</td>
                    <td className="text-right">{euro(r.newOpex)}</td>
                    <td className="text-right font-semibold">{euro(r.netSaving)}</td>
                    <td className="text-right font-semibold">{euro(r.cumulativeNetSaving)}</td>
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
function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="space-y-1 block">
      <span className="text-sm text-neutral-400">{label}</span>
      <input
        className="w-full rounded-xl bg-neutral-950 border border-neutral-700 px-3 py-2"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-2">
      <span className="text-sm text-neutral-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function AdminCell({ value, onChange }) {
  return (
    <td className="p-2 text-right">
      <input
        className="w-24 text-right bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </td>
  );
}
