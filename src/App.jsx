import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 30.4 – FINAL REAL ENTERPRISE APP

   Includes:
   - IT / EN language switch
   - Customer / Admin separation
   - Audit import: rows 1–29, column D quantity, column G watt
   - Product catalogue import in Admin only
   - Product override in Admin only
   - Corrected stacked savings logic
   - PowerAiD = % on Smart achieved saving
   - Multi-page PDF in selected language
   - Excel export
===================================================== */

const productsDefault = [
  {
    id: "street60",
    name: "VIMALUX Street 60",
    watt: 60,
    lumen: 10200,
    sellPrice: 190,
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
    install: 35,
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

const translations = {
  it: {
    version: "Versione 30.4 – Final Real Enterprise App",
    customerDashboard: "Dashboard Cliente",
    admin: "Admin",
    pdf: "Proposta PDF",
    excel: "Excel",
    language: "EN",

    led: "Solo LED",
    smart: "Smart CMS",
    premium: "Smart + PowerAiD",
    base: "Base",
    recommended: "Consigliato",
    premiumBadge: "Premium",

    idealFor: "Ideale per",
    ledBest: "Minore CAPEX iniziale",
    smartBest: "CLO + CMS + manutenzione + controllo",
    premiumBest: "Massimo risparmio e ottimizzazione",

    capex: "CAPEX",
    payback: "Payback",
    annualSaving: "Risparmio annuo",
    annualNetSaving: "Risparmio annuo netto",
    tenYearValue: "Valore netto 10 anni",
    energyReduction: "Riduzione energetica",
    npv: "NPV",

    auditImport: "Import Audit",
    auditHelp:
      "Importa il file audit VIMALUX. Legge solo righe 1–29, colonna D quantità, colonna G watt.",
    importAudit: "Importa Audit",

    projectInput: "Input Progetto",
    customer: "Cliente",
    municipality: "Comune",
    country: "Paese",
    contact: "Contatto",
    quantity: "Quantità",
    existingWattage: "Potenza media esistente",
    product: "Prodotto",
    installationIncluded: "Installazione inclusa",

    valueStack: "Value Stack",
    ledSaving: "Risparmio LED",
    cloSaving: "Risparmio CLO",
    smartSaving: "Risparmio Smart CMS / profili",
    maintenanceSaving: "Risparmio manutenzione",
    powerAidSaving: "PowerAiD",
    opex: "OPEX",

    adminAssumptions: "Admin Assumptions",
    productOverride: "Product Override",
    importCatalogue: "Import Product Catalogue",
    includeOperational: "Include operational upside in base",

    pdfTitle: "VIMALUX Proposta Smart Lighting",
    executiveSummary: "Sintesi Esecutiva",
    packageComparison: "Confronto Pacchetti",
    auditBaseline: "Baseline Audit",
    assumptions: "Assunzioni",
    disclaimer: "Disclaimer",
    nonBinding: "Proposta indicativa non vincolante",
    selectedPackage: "Pacchetto selezionato",
    sourceFile: "File sorgente",
    rowsUsed: "Righe utilizzate",
    importRule: "Regola import",
    manualInput: "Input manuale",
  },

  en: {
    version: "Version 30.4 – Final Real Enterprise App",
    customerDashboard: "Customer Dashboard",
    admin: "Admin",
    pdf: "PDF Proposal",
    excel: "Excel",
    language: "IT",

    led: "LED Only",
    smart: "Smart CMS",
    premium: "Smart + PowerAiD",
    base: "Base",
    recommended: "Recommended",
    premiumBadge: "Premium",

    idealFor: "Best for",
    ledBest: "Lowest upfront CAPEX",
    smartBest: "CLO + CMS + maintenance + control",
    premiumBest: "Maximum savings and optimization",

    capex: "CAPEX",
    payback: "Payback",
    annualSaving: "Annual saving",
    annualNetSaving: "Annual net saving",
    tenYearValue: "10-year net value",
    energyReduction: "Energy reduction",
    npv: "NPV",

    auditImport: "Audit Import",
    auditHelp:
      "Upload VIMALUX audit sheet. Reads only rows 1–29, column D quantity, column G watt.",
    importAudit: "Import Audit",

    projectInput: "Project Input",
    customer: "Customer",
    municipality: "Municipality",
    country: "Country",
    contact: "Contact",
    quantity: "Quantity",
    existingWattage: "Average existing wattage",
    product: "Product",
    installationIncluded: "Installation included",

    valueStack: "Value Stack",
    ledSaving: "LED saving",
    cloSaving: "CLO saving",
    smartSaving: "Smart CMS / profile saving",
    maintenanceSaving: "Maintenance saving",
    powerAidSaving: "PowerAiD saving",
    opex: "OPEX",

    adminAssumptions: "Admin Assumptions",
    productOverride: "Product Override",
    importCatalogue: "Import Product Catalogue",
    includeOperational: "Include operational upside in base",

    pdfTitle: "VIMALUX Smart Lighting Proposal",
    executiveSummary: "Executive Summary",
    packageComparison: "Package Comparison",
    auditBaseline: "Audit Baseline",
    assumptions: "Assumptions",
    disclaimer: "Disclaimer",
    nonBinding: "Indicative non-binding proposal",
    selectedPackage: "Selected package",
    sourceFile: "Source file",
    rowsUsed: "Rows used",
    importRule: "Import rule",
    manualInput: "Manual input",
  },
};

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

function findProductColumn(headers, names) {
  const lower = headers.map((h) => String(h || "").toLowerCase().trim());

  for (const name of names) {
    const target = name.toLowerCase();
    const idx = lower.findIndex((h) => h.includes(target));
    if (idx >= 0) return headers[idx];
  }

  return null;
}

function calcCase(project, a, product, offer) {
  const qty = n(project.quantity);
  const years = n(a.proposalYears) || 10;

  const oldEnergyKwh =
    (qty * n(project.existingWatt) * n(a.burningHours)) / 1000;

  const oldEnergyCost = oldEnergyKwh * n(a.energyPrice);

  const ledSaving = oldEnergyCost * (n(a.ledSavingPct) / 100);

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

  const powerAidSaving = offer.powerAid
    ? smartGrossSaving * (n(a.powerAidAdditionalSavingPct) / 100)
    : 0;

  const grossSaving =
    offer.id === "led" ? ledSaving : smartGrossSaving + powerAidSaving;

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
  const [lang, setLang] = useState("it");
  const t = translations[lang];

  const [products, setProducts] = useState(productsDefault);
  const [assumptions, setAssumptions] = useState(assumptionsDefault);
  const [admin, setAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [audit, setAudit] = useState(null);

  const [project, setProject] = useState({
    customer: "",
    municipality: "",
    country: "Italia",
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

  const offers = [
    {
      id: "led",
      title: t.led,
      badge: t.base,
      smart: false,
      powerAid: false,
      bestFor: t.ledBest,
    },
    {
      id: "smart",
      title: t.smart,
      badge: t.recommended,
      smart: true,
      powerAid: false,
      bestFor: t.smartBest,
    },
    {
      id: "premium",
      title: t.premium,
      badge: t.premiumBadge,
      smart: true,
      powerAid: true,
      bestFor: t.premiumBest,
    },
  ];

  const cases = useMemo(
    () => offers.map((o) => calcCase(project, assumptions, product, o)),
    [project, assumptions, product, lang]
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
          const qty = n(row[3]);
          const watt = n(row[6]);

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
        lang === "it"
          ? `Audit importato: ${Math.round(totalQty)} punti luce / ${avg.toFixed(
              1
            )} W`
          : `Audit imported: ${Math.round(totalQty)} luminaires / ${avg.toFixed(
              1
            )} W`
      );
    } catch (err) {
      console.error(err);
      showToast(lang === "it" ? "Errore import audit" : "Audit import failed");
    }

    e.target.value = "";
  }

  async function importProductCatalogue(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) throw new Error("No product rows");

      const headers = Object.keys(rows[0]);

      const nameCol = findProductColumn(headers, [
        "name",
        "product",
        "prodotto",
        "nome",
        "model",
      ]);
      const wattCol = findProductColumn(headers, ["watt", "w", "power"]);
      const lumenCol = findProductColumn(headers, ["lumen", "lm"]);
      const sellCol = findProductColumn(headers, [
        "sell",
        "sellPrice",
        "price",
        "prezzo",
        "sales",
      ]);
      const buyCol = findProductColumn(headers, ["buy", "buyPrice", "cost"]);
      const installCol = findProductColumn(headers, [
        "install",
        "installation",
        "posa",
        "montaggio",
      ]);

      const imported = rows
        .map((row, index) => ({
          id: `import_${Date.now()}_${index}`,
          name: String(row[nameCol] || `Product ${index + 1}`),
          watt: n(row[wattCol]),
          lumen: n(row[lumenCol]),
          sellPrice: n(row[sellCol]),
          buyPrice: n(row[buyCol]),
          install: n(row[installCol]),
        }))
        .filter((p) => p.name && p.watt > 0 && p.sellPrice > 0);

      if (!imported.length) throw new Error("No valid products");

      setProducts(imported);
      setProject((p) => ({ ...p, selectedProductId: imported[0].id }));

      showToast(
        lang === "it"
          ? `Catalogo prodotti importato: ${imported.length} prodotti`
          : `Product catalogue imported: ${imported.length} products`
      );
    } catch (err) {
      console.error(err);
      showToast(
        lang === "it"
          ? "Errore import catalogo prodotti"
          : "Product catalogue import failed"
      );
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

    XLSX.writeFile(wb, "VIMALUX_V30_4_Final.xlsx");
  }

  function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 30, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(9, 26, 58);
    doc.text(t.pdfTitle, 14, 13);

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

    pdfHeader(doc, `1. ${t.executiveSummary}`, t.nonBinding);

    autoTable(doc, {
      startY: 42,
      head: [[lang === "it" ? "Campo" : "Field", lang === "it" ? "Valore" : "Value"]],
      body: [
        [t.customer, project.customer || "-"],
        [t.municipality, project.municipality || "-"],
        [t.country, project.country || "-"],
        [t.selectedPackage, selected.title],
        [t.quantity, project.quantity],
        [t.existingWattage, `${project.existingWatt} W`],
        [t.product, product.name],
        [t.capex, euro(selected.capex)],
        [t.annualNetSaving, euro(selected.annualNetSaving)],
        [t.payback, `${dec(selected.payback)} ${lang === "it" ? "anni" : "years"}`],
        [t.tenYearValue, euro(selected.tenYearNet)],
      ],
      headStyles: { fillColor: navy },
    });

    doc.addPage();
    pdfHeader(doc, `2. ${t.packageComparison}`, "LED vs Smart vs Premium");

    autoTable(doc, {
      startY: 42,
      head: [[
        lang === "it" ? "Pacchetto" : "Package",
        t.capex,
        t.annualSaving,
        t.payback,
        t.tenYearValue,
        t.energyReduction,
      ]],
      body: cases.map((c) => [
        c.title,
        euro(c.capex),
        euro(c.annualNetSaving),
        `${dec(c.payback)} ${lang === "it" ? "anni" : "yrs"}`,
        euro(c.tenYearNet),
        `${dec(c.energyReductionPct)}%`,
      ]),
      headStyles: { fillColor: navy },
      styles: { fontSize: 8 },
    });

    doc.addPage();
    pdfHeader(doc, "3. Value Stack", "Stacked savings engine");

    autoTable(doc, {
      startY: 42,
      head: [[lang === "it" ? "Voce" : "Layer", lang === "it" ? "Valore annuo" : "Annual value", "Logic"]],
      body: [
        [t.ledSaving, euro(selected.ledSaving), `${assumptions.ledSavingPct}% baseline`],
        [t.cloSaving, euro(selected.cloSaving), selected.smart ? `${assumptions.cloSavingPct}%` : "-"],
        [t.smartSaving, euro(selected.smartSolutionSaving), selected.smart ? `${assumptions.smartSolutionSavingPct}%` : "-"],
        [t.maintenanceSaving, euro(selected.maintenanceSaving), selected.smart ? `${assumptions.maintenanceSavingPct}%` : "-"],
        [t.powerAidSaving, euro(selected.powerAidSaving), selected.powerAid ? `${assumptions.powerAidAdditionalSavingPct}% on Smart saving` : "-"],
        [t.opex, `-${euro(selected.opex)}`, "CMS / PowerAiD"],
      ],
      headStyles: { fillColor: navy },
      styles: { fontSize: 8.5 },
    });

    doc.addPage();
    pdfHeader(doc, `4. ${t.auditBaseline}`, "Imported customer audit sheet");

    autoTable(doc, {
      startY: 42,
      head: [[lang === "it" ? "Parametro" : "Parameter", lang === "it" ? "Valore" : "Value"]],
      body: [
        [t.sourceFile, audit?.fileName || t.manualInput],
        [t.rowsUsed, audit?.rows || "-"],
        [t.quantity, project.quantity],
        [t.existingWattage, `${project.existingWatt} W`],
        [t.importRule, "Rows 1–29, Column D = quantity, Column G = watt"],
      ],
      headStyles: { fillColor: navy },
    });

    doc.addPage();
    pdfHeader(doc, `5. ${t.assumptions}`, "Admin modelling inputs");

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
    pdfHeader(doc, `6. ${t.disclaimer}`, t.nonBinding);

    const disclaimer =
      lang === "it"
        ? [
            "La presente proposta è indicativa e non vincolante.",
            "",
            "Tutti i calcoli si basano su dati forniti dal cliente, input audit importati, assunzioni standard di mercato e condizioni operative stimate.",
            "",
            "I termini commerciali finali, il perimetro tecnico, la struttura finanziaria, l’approvazione creditizia e il piano di implementazione restano soggetti a due diligence, negoziazione contrattuale e approvazione finale.",
            "",
            "I risparmi possono variare in funzione delle ore di accensione, tariffe energia, profili di dimmerazione, baseline inventario, regime manutentivo ed esecuzione operativa.",
          ]
        : [
            "This proposal is indicative and non-binding.",
            "",
            "All calculations are based on customer supplied data, imported audit inputs, standard market assumptions and estimated operating conditions.",
            "",
            "Final commercial terms, technical scope, financing structure, credit approval and implementation schedule remain subject to due diligence, contract negotiation and management approval.",
            "",
            "Savings may vary depending on burn hours, tariffs, dimming profile, baseline inventory, maintenance regime and operational execution.",
          ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(disclaimer.join("\n"), 14, 48, { maxWidth: 180 });

    doc.save(lang === "it" ? "VIMALUX_Proposta.pdf" : "VIMALUX_Proposal.pdf");
  }

  return (
    <div style={s.page}>
      {toast && (
        <div style={toast.toLowerCase().includes("errore") || toast.toLowerCase().includes("failed") ? s.toastErr : s.toast}>
          {toast}
        </div>
      )}

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>VIMALUX Lighting AI Portal</h1>
          <p style={s.sub}>{t.version}</p>
        </div>

        <div style={s.row}>
          <button
            style={!admin ? s.btnDark : s.btn}
            onClick={() => setAdmin(false)}
          >
            {t.customerDashboard}
          </button>

          <button
            style={admin ? s.btnDark : s.btn}
            onClick={() => {
              setAdmin(true);
              setTimeout(
                () => adminRef.current?.scrollIntoView({ behavior: "smooth" }),
                100
              );
            }}
          >
            {t.admin}
          </button>

          <button style={s.btnDark} onClick={exportPdf}>
            {t.pdf}
          </button>

          <button style={s.btn} onClick={exportExcel}>
            {t.excel}
          </button>

          <button
            style={s.btn}
            onClick={() => setLang(lang === "it" ? "en" : "it")}
          >
            {t.language}
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

            <p style={s.bestFor}>
              {t.idealFor}: {c.bestFor}
            </p>

            <div style={s.metricRow}>
              <span>
                {t.capex}
                <br />
                <b>{euro(c.capex)}</b>
              </span>
              <span>
                {t.payback}
                <br />
                <b>{dec(c.payback)} {lang === "it" ? "anni" : "yrs"}</b>
              </span>
            </div>

            <div style={s.metricRow}>
              <span>
                {t.annualSaving}
                <br />
                <b>{euro(c.annualNetSaving)}</b>
              </span>
              <span>
                {t.tenYearValue}
                <br />
                <b>{euro(c.tenYearNet)}</b>
              </span>
            </div>

            <p style={s.green}>
              {t.energyReduction}: {dec(c.energyReductionPct)}%
            </p>
          </button>
        ))}
      </div>

      <div style={s.auditBox}>
        <div>
          <b>{t.auditImport}</b>
          <br />
          {audit
            ? `${audit.fileName}: ${Math.round(
                audit.quantity
              )} ${lang === "it" ? "punti luce" : "luminaires"} · ${audit.averageWatt.toFixed(1)} W`
            : t.auditHelp}
        </div>

        <label style={s.greenBtn}>
          {t.importAudit}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={importAudit}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div style={s.kpis}>
        <Kpi label={t.annualNetSaving} value={euro(selected.annualNetSaving)} />
        <Kpi label={t.payback} value={`${dec(selected.payback)} ${lang === "it" ? "anni" : "yrs"}`} />
        <Kpi label={t.tenYearValue} value={euro(selected.tenYearNet)} />
        <Kpi label={t.capex} value={euro(selected.capex)} />
        <Kpi label={t.energyReduction} value={`${dec(selected.energyReductionPct)}%`} />
        <Kpi label={t.npv} value={euro(selected.valueNpv)} />
      </div>

      <div style={s.grid2}>
        <div style={s.card}>
          <h2>{t.projectInput}</h2>

          <div style={s.formGrid}>
            <Input label={t.customer} value={project.customer} onChange={(v) => updateProject("customer", v)} />
            <Input label={t.municipality} value={project.municipality} onChange={(v) => updateProject("municipality", v)} />
            <Input label={t.country} value={project.country} onChange={(v) => updateProject("country", v)} />
            <Input label={t.contact} value={project.contact} onChange={(v) => updateProject("contact", v)} />
            <Input label={t.quantity} value={project.quantity} onChange={(v) => updateProject("quantity", n(v))} />
            <Input label={t.existingWattage} value={project.existingWatt} onChange={(v) => updateProject("existingWatt", n(v))} />

            <label>
              {t.product}
              <select
                style={s.input}
                value={project.selectedProductId}
                onChange={(e) =>
                  updateProject("selectedProductId", e.target.value)
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} – {p.watt}W
                  </option>
                ))}
              </select>
            </label>

            <label style={s.check}>
              {t.installationIncluded}
              <input
                type="checkbox"
                checked={project.includeInstallation}
                onChange={(e) =>
                  updateProject("includeInstallation", e.target.checked)
                }
              />
            </label>
          </div>
        </div>

        <div style={s.card}>
          <h2>{t.valueStack}</h2>
          <Bar label={t.ledSaving} value={selected.ledSaving} max={selected.grossSaving} />
          <Bar label={t.cloSaving} value={selected.cloSaving} max={selected.grossSaving} />
          <Bar label={t.smartSaving} value={selected.smartSolutionSaving} max={selected.grossSaving} />
          <Bar label={t.maintenanceSaving} value={selected.maintenanceSaving} max={selected.grossSaving} />
          <Bar label={t.powerAidSaving} value={selected.powerAidSaving} max={selected.grossSaving} />
          <Bar label={t.opex} value={-selected.opex} max={selected.grossSaving} red />
        </div>
      </div>

      <div ref={adminRef}>
        {admin && (
          <div style={s.grid2}>
            <div style={s.card}>
              <h2>{t.adminAssumptions}</h2>

              <label style={s.importBtn}>
                {t.importCatalogue}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={importProductCatalogue}
                  style={{ display: "none" }}
                />
              </label>

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

              <label style={s.check}>
                {t.includeOperational}
                <input
                  type="checkbox"
                  checked={project.includeOperationalInBase}
                  onChange={(e) =>
                    updateProject("includeOperationalInBase", e.target.checked)
                  }
                />
              </label>
            </div>

            <div style={s.card}>
              <h2>{t.productOverride}</h2>

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

function Bar({ label, value, max, red }) {
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
            background: red ? "#ef4444" : "#2563eb",
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
  importBtn: {
    display: "inline-block",
    background: "#0f172a",
    color: "#fff",
    borderRadius: 14,
    padding: "13px 18px",
    fontWeight: 900,
    cursor: "pointer",
    marginBottom: 18,
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
    marginTop: 14,
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
