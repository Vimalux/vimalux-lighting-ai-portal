import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 30.1 – UI + CORRECTED STACKED SAVINGS ENGINE

   Corrected logic:
   1) LED Only:
      - 55% energy saving only
      - CAPEX = luminaire + installation

   2) Smart CMS:
      - LED saving
      - CLO saving
      - Smart CMS / profile saving
      - Maintenance saving
      - Operational value if included
      - CAPEX = luminaire + installation + smart node
      - OPEX = CMS fee

   3) Smart + PowerAiD:
      - Smart CMS total gross saving
      - + PowerAiD additional saving as % on Smart CMS achieved saving
      - CAPEX = same as Smart CMS
      - OPEX = CMS fee + PowerAiD fee
===================================================== */

const productsDefault = [
  {
    id: "street60",
    name: "VIMALUX Street 60",
    watt: 60,
    lumen: 10200,
    sellPrice: 155,
    buyPrice: 110,
    install: 35,
  },
  {
    id: "road90",
    name: "VIMALUX Road 90",
    watt: 90,
    lumen: 15300,
    sellPrice: 210,
    buyPrice: 150,
    install: 40,
  },
  {
    id: "highway120",
    name: "VIMALUX Highway 120",
    watt: 120,
    lumen: 20400,
    sellPrice: 285,
    buyPrice: 205,
    install: 45,
  },
];

const assumptionsDefault = {
  ledSavingPct: 55,
  cloSavingPct: 10,
  smartSolutionSavingPct: 20,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  powerAidAdditionalSavingPct: 40,

  energyPrice: 0.29,
  burningHours: 4200,

  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,

  proposalYears: 10,
  discountRatePct: 7,
  kgCo2PerKwh: 0.42,

  serviceEfficiencyPerLampYear: 10,
  fewerFailuresPerLampYear: 6,
  adminReductionPerLampYear: 4,
};

const offers = [
  {
    id: "led",
    title: "LED Only",
    badge: "Base",
    smart: false,
    powerAid: false,
    bestFor: "Lowest upfront CAPEX",
  },
  {
    id: "smart",
    title: "Smart CMS",
    badge: "Recommended",
    smart: true,
    powerAid: false,
    bestFor: "CLO + CMS + maintenance + control",
  },
  {
    id: "premium",
    title: "Smart + PowerAiD",
    badge: "Premium",
    smart: true,
    powerAid: true,
    bestFor: "Highest stacked savings and optimization",
  },
];

function n(v) {
  if (v === "" || v === null || v === undefined) return 0;
  return Number(String(v).replace(",", ".")) || 0;
}

function euro(v) {
  return `€${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(n(v))}`;
}

function dec(v, d = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n(v));
}

function npv(ratePct, annualCash, years, initialCapex) {
  const rate = n(ratePct) / 100;
  let value = -initialCapex;

  for (let y = 1; y <= years; y += 1) {
    value += annualCash / Math.pow(1 + rate, y);
  }

  return value;
}

function calcCase(project, a, product, offer) {
  const qty = n(project.quantity);
  const years = n(a.proposalYears) || 10;

  const oldEnergyKwh =
    (qty * n(project.existingWatt) * n(a.burningHours)) / 1000;

  const oldEnergyCost = oldEnergyKwh * n(a.energyPrice);

  // LED Only is always exactly 55% saving on old baseline.
  const ledSaving = oldEnergyCost * (n(a.ledSavingPct) / 100);

  // Smart layers are added only when Smart is selected.
  const cloSaving = offer.smart
    ? ledSaving * (n(a.cloSavingPct) / 100)
    : 0;

  const smartSolutionSaving = offer.smart
    ? ledSaving * (n(a.smartSolutionSavingPct) / 100)
    : 0;

  const maintenanceSaving = offer.smart
    ? qty *
      n(a.maintenanceOldPerLamp) *
      (n(a.maintenanceSavingPct) / 100)
    : 0;

  const operationalUpside = offer.smart
    ? qty *
      (n(a.serviceEfficiencyPerLampYear) +
        n(a.fewerFailuresPerLampYear) +
        n(a.adminReductionPerLampYear))
    : 0;

  const smartGrossSaving =
    ledSaving +
    cloSaving +
    smartSolutionSaving +
    maintenanceSaving +
    (project.includeOperationalInBase ? operationalUpside : 0);

  // PowerAiD is 40% on the Smart achieved saving.
  const powerAidSaving = offer.powerAid
    ? smartGrossSaving * (n(a.powerAidAdditionalSavingPct) / 100)
    : 0;

  const grossSaving =
    offer.id === "led"
      ? ledSaving
      : smartGrossSaving + powerAidSaving;

  const opex =
    (offer.smart ? qty * n(a.cmsFeePerLampYear) : 0) +
    (offer.powerAid ? qty * n(a.powerAidFeePerLampYear) : 0);

  const annualNetSaving = grossSaving - opex;

  const luminaireCapex = qty * n(product.sellPrice);
  const installationCapex = project.includeInstallation
    ? qty * n(product.install)
    : 0;
  const smartCapex = offer.smart ? qty * n(a.smartNodeCost) : 0;

  const capex = luminaireCapex + installationCapex + smartCapex;

  const payback = annualNetSaving > 0 ? capex / annualNetSaving : 0;
  const tenYearNet = annualNetSaving * years;
  const valueNpv = npv(n(a.discountRatePct), annualNetSaving, years, capex);

  const energySavingOnly =
    ledSaving + cloSaving + smartSolutionSaving + powerAidSaving;

  const energyReductionPct =
    oldEnergyCost > 0 ? (energySavingOnly / oldEnergyCost) * 100 : 0;

  const co2SavedTons =
    oldEnergyCost > 0
      ? (energySavingOnly / n(a.energyPrice)) * n(a.kgCo2PerKwh) / 1000
      : 0;

  return {
    ...offer,
    productName: product.name,
    qty,
    capex,
    luminaireCapex,
    installationCapex,
    smartCapex,
    oldEnergyCost,
    ledSaving,
    cloSaving,
    smartSolutionSaving,
    maintenanceSaving,
    operationalUpside,
    smartGrossSaving,
    powerAidSaving,
    grossSaving,
    opex,
    annualNetSaving,
    payback,
    tenYearNet,
    valueNpv,
    energyReductionPct,
    co2SavedTons,
  };
}

export default function App() {
  const [products, setProducts] = useState(productsDefault);
  const [assumptions, setAssumptions] = useState(assumptionsDefault);
  const [admin, setAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [audit, setAudit] = useState(null);

  const [project, setProject] = useState({
    customer: "",
    municipality: "",
    country: "Italy",
    contact: "",
    quantity: 500,
    existingWatt: 100,
    selectedProductId: "street60",
    selectedOffer: "premium",
    includeInstallation: true,
    includeOperationalInBase: false,
  });

  const adminRef = useRef(null);

  const product =
    products.find((p) => p.id === project.selectedProductId) || products[0];

  const cases = useMemo(
    () => offers.map((o) => calcCase(project, assumptions, product, o)),
    [project, assumptions, product]
  );

  const selected =
    cases.find((c) => c.id === project.selectedOffer) || cases[0];

  function updateProject(key, value) {
    setProject((p) => ({ ...p, [key]: value }));
  }

  function updateAssumption(key, value) {
    setAssumptions((p) => ({ ...p, [key]: value }));
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(""), 3500);
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

        const raw = XLSX.utils
          .sheet_to_json(sheet, { header: 1, defval: "" })
          .slice(0, 29);

        raw.forEach((row) => {
          const qty = n(row[3]); // Column D
          const watt = n(row[6]); // Column G

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

      showToast(
        `Audit imported: ${Math.round(totalQty)} luminaires / ${avg.toFixed(
          1
        )} W`
      );
    } catch (err) {
      console.error(err);
      showToast("Audit import failed");
    }

    e.target.value = "";
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cases), "Cases");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([project]),
      "Project"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([assumptions]),
      "Assumptions"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(products),
      "Products"
    );

    if (audit) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([audit]),
        "Audit"
      );
    }

    XLSX.writeFile(wb, "VIMALUX_V30_Stacked_Savings.xlsx");
  }

  function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 30, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(9, 26, 58);
    doc.text("VIMALUX Smart Lighting Proposal", 14, 13);

    doc.setFontSize(13);
    doc.text(title, 14, 23);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitle, 120, 23);
  }

  function exportPdf() {
    const doc = new jsPDF("p", "mm", "a4");
    const navy = [9, 26, 58];

    pdfHeader(doc, "1. Executive Summary", "Commercial overview");

    autoTable(doc, {
      startY: 42,
      head: [["Field", "Value"]],
      body: [
        ["Customer", project.customer || "-"],
        ["Municipality", project.municipality || "-"],
        ["Country", project.country || "-"],
        ["Selected package", selected.title],
        ["Quantity", project.quantity],
        ["Existing wattage", `${project.existingWatt} W`],
        ["Product", product.name],
        ["CAPEX", euro(selected.capex)],
        ["Annual net saving", euro(selected.annualNetSaving)],
        ["Payback", `${dec(selected.payback)} years`],
        ["10Y net value", euro(selected.tenYearNet)],
      ],
      headStyles: { fillColor: navy },
    });

    doc.addPage();
    pdfHeader(doc, "2. Offer Comparison", "LED vs Smart vs Premium");

    autoTable(doc, {
      startY: 42,
      head: [
        [
          "Package",
          "CAPEX",
          "Annual net",
          "Payback",
          "10Y net",
          "Energy reduction",
        ],
      ],
      body: cases.map((c) => [
        c.title,
        euro(c.capex),
        euro(c.annualNetSaving),
        `${dec(c.payback)} yrs`,
        euro(c.tenYearNet),
        `${dec(c.energyReductionPct)}%`,
      ]),
      headStyles: { fillColor: navy },
      styles: { fontSize: 8 },
    });

    doc.addPage();
    pdfHeader(doc, "3. Value Stack", "Corrected stacked savings engine");

    autoTable(doc, {
      startY: 42,
      head: [["Layer", "Annual value", "Logic"]],
      body: [
        [
          "LED saving",
          euro(selected.ledSaving),
          `${assumptions.ledSavingPct}% on old baseline energy cost`,
        ],
        [
          "CLO saving",
          euro(selected.cloSaving),
          selected.smart ? `${assumptions.cloSavingPct}% on LED saving` : "Not included",
        ],
        [
          "Smart CMS / profile saving",
          euro(selected.smartSolutionSaving),
          selected.smart
            ? `${assumptions.smartSolutionSavingPct}% on LED saving`
            : "Not included",
        ],
        [
          "Maintenance saving",
          euro(selected.maintenanceSaving),
          selected.smart
            ? `${assumptions.maintenanceSavingPct}% maintenance reduction`
            : "Not included",
        ],
        [
          "Operational upside",
          euro(selected.operationalUpside),
          project.includeOperationalInBase
            ? "Included in base"
            : "Shown separately / not included",
        ],
        [
          "PowerAiD saving",
          euro(selected.powerAidSaving),
          selected.powerAid
            ? `${assumptions.powerAidAdditionalSavingPct}% on Smart achieved saving`
            : "Not included",
        ],
        ["Recurring OPEX", `-${euro(selected.opex)}`, "CMS / PowerAiD annual fees"],
      ],
      headStyles: { fillColor: navy },
      styles: { fontSize: 8.5 },
    });

    doc.addPage();
    pdfHeader(doc, "4. Audit Baseline", "Imported customer audit sheet");

    autoTable(doc, {
      startY: 42,
      head: [["Audit parameter", "Value"]],
      body: [
        ["Source file", audit?.fileName || "Manual input"],
        ["Rows used", audit?.rows || "-"],
        ["Quantity", project.quantity],
        ["Average existing wattage", `${project.existingWatt} W`],
        ["Rule", "Rows 1–29, Column D = quantity, Column G = watt"],
      ],
      headStyles: { fillColor: navy },
    });

    doc.addPage();
    pdfHeader(doc, "5. Assumptions", "Admin modelling inputs");

    autoTable(doc, {
      startY: 42,
      head: [["Parameter", "Value"]],
      body: Object.entries(assumptions).map(([key, value]) => [
        key,
        String(value),
      ]),
      headStyles: { fillColor: navy },
      styles: { fontSize: 8 },
    });

    doc.addPage();
    pdfHeader(doc, "6. Disclaimer", "Indicative non-binding proposal");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(
      [
        "This proposal is indicative and non-binding.",
        "",
        "All calculations are based on customer supplied data, imported audit inputs, standard market assumptions and estimated operating conditions.",
        "",
        "Final commercial terms, technical scope, financing structure, credit approval and implementation schedule remain subject to due diligence, contract negotiation and management approval.",
        "",
        "Savings may vary depending on burn hours, tariffs, dimming profile, baseline inventory, maintenance regime and operational execution.",
      ].join("\n"),
      14,
      48,
      { maxWidth: 180 }
    );

    doc.save("VIMALUX_V30_Stacked_Savings_Proposal.pdf");
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={toast.includes("failed") ? s.toastErr : s.toast}>
          {toast}
        </div>
      )}

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>VIMALUX Lighting AI Portal</h1>
          <p style={s.sub}>Version 30.1 – Corrected Stacked Savings Engine</p>
        </div>

        <div style={s.row}>
          <button style={s.btnDark}>Customer</button>
          <button
            style={s.btn}
            onClick={() => {
              setAdmin(true);
              setTimeout(
                () => adminRef.current?.scrollIntoView({ behavior: "smooth" }),
                100
              );
            }}
          >
            Admin
          </button>
          <button style={s.btnDark} onClick={exportPdf}>
            PDF Proposal
          </button>
          <button style={s.btn} onClick={exportExcel}>
            Excel
          </button>
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

            <p style={s.bestFor}>Best for: {c.bestFor}</p>

            <div style={s.metricRow}>
              <span>
                CAPEX
                <br />
                <b>{euro(c.capex)}</b>
              </span>
              <span>
                Payback
                <br />
                <b>{dec(c.payback)} yrs</b>
              </span>
            </div>

            <div style={s.metricRow}>
              <span>
                Annual net
                <br />
                <b>{euro(c.annualNetSaving)}</b>
              </span>
              <span>
                10Y net
                <br />
                <b>{euro(c.tenYearNet)}</b>
              </span>
            </div>

            <p style={s.green}>
              Energy reduction: {dec(c.energyReductionPct)}%
            </p>
          </button>
        ))}
      </div>

      <div style={s.auditBox}>
        <div>
          <b>Audit import</b>
          <br />
          {audit
            ? `${audit.fileName}: ${Math.round(
                audit.quantity
              )} luminaires · ${audit.averageWatt.toFixed(1)} W avg`
            : "Upload VIMALUX audit sheet. Reads only rows 1–29, column D quantity, column G watt."}
        </div>

        <label style={s.greenBtn}>
          Import Audit Sheet
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={importAudit}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={s.kpis}>
        <Kpi label="Annual Net Saving" value={euro(selected.annualNetSaving)} />
        <Kpi label="Payback" value={`${dec(selected.payback)} yrs`} />
        <Kpi label="10Y Net Value" value={euro(selected.tenYearNet)} />
        <Kpi label="CAPEX" value={euro(selected.capex)} />
        <Kpi
          label="Energy Reduction"
          value={`${dec(selected.energyReductionPct)}%`}
        />
        <Kpi label="NPV" value={euro(selected.valueNpv)} />
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <h2>Project Input</h2>

          <div style={s.formGrid}>
            <Input
              label="Customer"
              value={project.customer}
              onChange={(v) => updateProject("customer", v)}
            />
            <Input
              label="Municipality"
              value={project.municipality}
              onChange={(v) => updateProject("municipality", v)}
            />
            <Input
              label="Country"
              value={project.country}
              onChange={(v) => updateProject("country", v)}
            />
            <Input
              label="Contact"
              value={project.contact}
              onChange={(v) => updateProject("contact", v)}
            />
            <Input
              label="Quantity"
              value={project.quantity}
              onChange={(v) => updateProject("quantity", n(v))}
            />
            <Input
              label="Existing wattage"
              value={project.existingWatt}
              onChange={(v) => updateProject("existingWatt", n(v))}
            />

            <label>
              Product
              <select
                style={s.input}
                value={project.selectedProductId}
                onChange={(e) =>
                  updateProject("selectedProductId", e.target.value)
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {p.watt}W – {euro(p.sellPrice)}
                  </option>
                ))}
              </select>
            </label>

            <label style={s.check}>
              Installation included
              <input
                type="checkbox"
                checked={project.includeInstallation}
                onChange={(e) =>
                  updateProject("includeInstallation", e.target.checked)
                }
              />
            </label>

            <label style={s.check}>
              Include operational upside in base
              <input
                type="checkbox"
                checked={project.includeOperationalInBase}
                onChange={(e) =>
                  updateProject("includeOperationalInBase", e.target.checked)
                }
              />
            </label>
          </div>
        </div>

        <div style={s.card}>
          <h2>Value Stack</h2>
          <Bar
            label="LED saving"
            value={selected.ledSaving}
            max={selected.grossSaving}
          />
          <Bar
            label="CLO saving"
            value={selected.cloSaving}
            max={selected.grossSaving}
          />
          <Bar
            label="Smart CMS / profile saving"
            value={selected.smartSolutionSaving}
            max={selected.grossSaving}
          />
          <Bar
            label="Maintenance saving"
            value={selected.maintenanceSaving}
            max={selected.grossSaving}
          />
          <Bar
            label="Operational upside"
            value={project.includeOperationalInBase ? selected.operationalUpside : 0}
            max={selected.grossSaving}
            green
          />
          <Bar
            label="PowerAiD saving"
            value={selected.powerAidSaving}
            max={selected.grossSaving}
          />
          <Bar label="OPEX" value={-selected.opex} max={selected.grossSaving} red />
        </div>
      </div>

      <div ref={adminRef}>
        {admin && (
          <div style={s.grid2}>
            <div style={s.card}>
              <h2>Admin Assumptions</h2>
              <div style={s.formGrid}>
                {Object.entries(assumptions).map(([k, v]) => (
                  <Input
                    key={k}
                    label={k}
                    value={v}
                    onChange={(x) => updateAssumption(k, x)}
                  />
                ))}
              </div>
            </div>

            <div style={s.card}>
              <h2>Product Override</h2>

              {products.map((p, i) => (
                <div key={p.id} style={s.productRow}>
                  <input
                    style={s.input}
                    value={p.name}
                    onChange={(e) => {
                      const next = [...products];
                      next[i] = { ...next[i], name: e.target.value };
                      setProducts(next);
                    }}
                  />
                  <input
                    style={s.smallInput}
                    value={p.watt}
                    onChange={(e) => {
                      const next = [...products];
                      next[i] = { ...next[i], watt: n(e.target.value) };
                      setProducts(next);
                    }}
                  />
                  <input
                    style={s.smallInput}
                    value={p.sellPrice}
                    onChange={(e) => {
                      const next = [...products];
                      next[i] = { ...next[i], sellPrice: n(e.target.value) };
                      setProducts(next);
                    }}
                  />
                  <input
                    style={s.smallInput}
                    value={p.install}
                    onChange={(e) => {
                      const next = [...products];
                      next[i] = { ...next[i], install: n(e.target.value) };
                      setProducts(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={s.kpi}>
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label>
      {label}
      <input
        style={s.input}
        value={String(value).replace(".", ",")}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Bar({ label, value, max, red, green }) {
  const w = Math.min((Math.abs(n(value)) / Math.max(1, n(max))) * 100, 100);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={s.barTop}>
        <b>{label}</b>
        <b>
          {value < 0 ? "-" : ""}
          {euro(Math.abs(value))}
        </b>
      </div>
      <div style={s.track}>
        <div
          style={{
            ...s.fill,
            width: `${Math.max(3, w)}%`,
            background: red ? "#ef4444" : green ? "#22c55e" : "#2563eb",
          }}
        />
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 28,
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  header: {
    background: "#fff",
    border: "1px solid #dbe3ee",
    borderRadius: 24,
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 20,
    flexWrap: "wrap",
  },
  h1: { margin: 0, fontSize: 32 },
  sub: { margin: "6px 0 0", color: "#64748b" },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  btn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnDark: {
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#fff",
    borderRadius: 14,
    padding: "12px 18px",
    fontWeight: 800,
    cursor: "pointer",
  },
  cards3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  offer: {
    background: "#fff",
    border: "1px solid #dbe3ee",
    borderRadius: 22,
    padding: 18,
    textAlign: "left",
    cursor: "pointer",
  },
  offerSel: {
    background: "#eff6ff",
    border: "2px solid #2563eb",
    borderRadius: 22,
    padding: 17,
    textAlign: "left",
    cursor: "pointer",
  },
  offerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 800,
  },
  bestFor: { color: "#64748b", marginTop: 0 },
  metricRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    fontSize: 13,
    marginTop: 10,
  },
  green: { color: "#059669", fontWeight: 900 },
  auditBox: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  },
  greenBtn: {
    background: "#16a34a",
    color: "#fff",
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  kpi: {
    background: "#fff",
    border: "1px solid #dbe3ee",
    borderRadius: 22,
    padding: 18,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #dbe3ee",
    borderRadius: 22,
    padding: 22,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px",
    marginTop: 6,
  },
  smallInput: {
    width: 90,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "10px",
  },
  check: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: 12,
  },
  barTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  track: {
    height: 12,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 999 },
  productRow: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 90px 90px",
    gap: 10,
    marginBottom: 10,
  },
  toast: {
    position: "fixed",
    right: 20,
    top: 20,
    background: "#16a34a",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
    zIndex: 10,
  },
  toastErr: {
    position: "fixed",
    right: 20,
    top: 20,
    background: "#dc2626",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: 14,
    fontWeight: 900,
    zIndex: 10,
  },
};
