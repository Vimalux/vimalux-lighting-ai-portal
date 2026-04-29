import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ADMIN_PIN = "2026";

const defaultProducts = [
  { id: "urban45", name: "VIMALUX Urban 45W Smart", watt: 45, sellPrice: 135, buyPrice: 95, install: 35 },
  { id: "street60", name: "VIMALUX Street Pro 60W Smart", watt: 60, sellPrice: 150, buyPrice: 110, install: 35 },
  { id: "main90", name: "VIMALUX Main Road 90W Smart", watt: 90, sellPrice: 185, buyPrice: 140, install: 35 },
  { id: "decor35", name: "VIMALUX Decorative Retrofit 35W Smart", watt: 35, sellPrice: 120, buyPrice: 85, install: 35 }
];

const defaultAssumptions = {
  energyPrice: 0.29,
  maintenanceCost: 25,
  maintenanceReduction: 75,
  smartDimmingSaving: 20,
  powerAidExtraSaving: 40,
  years: 10,
  co2Factor: 0.42,
  smartFee: 6,
  powerAidFee: 3
};

const demoRows = [
  { id: 1, area: "Main roads", existingType: "HPS 150W", existingWatt: 150, qty: 320, hours: 4200 },
  { id: 2, area: "Urban roads", existingType: "HPS 120W", existingWatt: 120, qty: 500, hours: 4200 }
];

const labels = {
  EN: {
    version: "VIMALUX LIGHTING AI PORTAL · VERSION 12A",
    title: "Smart LED ROI Calculator",
    subtitle: "Customer-safe proposal engine with protected admin controls.",
    dashboard: "Dashboard",
    proposal: "Proposal",
    admin: "Admin",
    adminLogin: "Admin login",
    adminActive: "Admin active",
    logout: "Logout",
    upload: "Upload audit Excel",
    demo: "Load demo case",
    print: "Export Proposal PDF",
    export: "Export CSV",
    client: "Client",
    totalLamps: "Total lamps",
    solution: "Selected solution",
    capex: "Estimated project CAPEX",
    annualSaving: "Annual net saving",
    payback: "Simple payback",
    roi: "ROI/year",
    co2: "CO₂ saving/year",
    netBenefit: "10-year net benefit",
    led: "LED only",
    smart: "Smart LED",
    premium: "Smart LED + PowerAiD",
    energy: "Energy comparison",
    existing: "Existing system",
    newSystem: "New system",
    value: "Customer value",
    proposalTitle: "Preliminary Smart LED Proposal",
    disclaimer: "Preliminary and non-binding. Final offer depends on technical audit, lighting design, product confirmation, installation conditions, contract structure and financing approval.",
    noRows: "No valid VIMALUX audit rows found. Check quantity in column D and wattage in column G.",
    nextSteps: "Recommended next step",
    nextText: "Validate the lighting inventory, confirm technical requirements, and prepare a final commercial proposal.",
    products: "Product catalogue",
    assumptions: "Commercial assumptions",
    dataControls: "Data controls",
    addProduct: "Add product",
    reset: "Reset catalogue",
    clear: "Clear local data",
    delete: "Delete",
    importCatalog: "Import product catalogue",
    exportCatalog: "Export catalogue"
  },
  IT: {
    version: "VIMALUX LIGHTING AI PORTAL · VERSIONE 12A",
    title: "Calcolatore ROI Smart LED",
    subtitle: "Motore proposta cliente con controlli admin protetti.",
    dashboard: "Dashboard",
    proposal: "Proposta",
    admin: "Admin",
    adminLogin: "Login admin",
    adminActive: "Admin attivo",
    logout: "Esci",
    upload: "Carica audit Excel",
    demo: "Carica caso demo",
    print: "Esporta proposta PDF",
    export: "Esporta CSV",
    client: "Cliente",
    totalLamps: "Totale lampade",
    solution: "Soluzione selezionata",
    capex: "CAPEX progetto stimato",
    annualSaving: "Risparmio netto annuo",
    payback: "Payback semplice",
    roi: "ROI/anno",
    co2: "Risparmio CO₂/anno",
    netBenefit: "Beneficio netto 10 anni",
    led: "Solo LED",
    smart: "Smart LED",
    premium: "Smart LED + PowerAiD",
    energy: "Confronto energia",
    existing: "Sistema esistente",
    newSystem: "Nuovo sistema",
    value: "Valore per il cliente",
    proposalTitle: "Proposta preliminare Smart LED",
    disclaimer: "Preliminare e non vincolante. Offerta finale soggetta ad audit tecnico, lighting design, conferma prodotto, condizioni installative, struttura contrattuale e approvazione finanziaria.",
    noRows: "Nessuna riga audit VIMALUX valida trovata. Verificare quantità in colonna D e wattaggio in colonna G.",
    nextSteps: "Prossimo passo consigliato",
    nextText: "Validare l’inventario illuminotecnico, confermare i requisiti tecnici e preparare una proposta commerciale finale.",
    products: "Catalogo prodotti",
    assumptions: "Assunzioni commerciali",
    dataControls: "Controlli dati",
    addProduct: "Aggiungi prodotto",
    reset: "Reset catalogo",
    clear: "Cancella dati locali",
    delete: "Elimina",
    importCatalog: "Importa catalogo prodotti",
    exportCatalog: "Esporta catalogo"
  }
};

function eur(v) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function num(v) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(v || 0);
}

function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("vml_lang") || "EN");
  const [page, setPage] = useState("dashboard");
  const [client, setClient] = useState("Comune Demo");
  const [packageType, setPackageType] = useState("premium");
  const [rows, setRows] = useState(() => readSaved("vml_rows", demoRows));
  const [products, setProducts] = useState(() => readSaved("vml_products", defaultProducts));
  const [assumptions, setAssumptions] = useState(() => readSaved("vml_assumptions", defaultAssumptions));
  const [admin, setAdmin] = useState(false);
  const [pin, setPin] = useState("");

  const t = labels[lang];

  useEffect(() => localStorage.setItem("vml_lang", lang), [lang]);
  useEffect(() => localStorage.setItem("vml_rows", JSON.stringify(rows)), [rows]);
  useEffect(() => localStorage.setItem("vml_products", JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem("vml_assumptions", JSON.stringify(assumptions)), [assumptions]);

  function packageName(type) {
    if (type === "led") return t.led;
    if (type === "smart") return t.smart;
    return t.premium;
  }

  function packageFee(type) {
    if (type === "led") return 0;
    if (type === "smart") return Number(assumptions.smartFee);
    return Number(assumptions.smartFee) + Number(assumptions.powerAidFee);
  }

  function extraSavingPct(type) {
    if (type === "led") return 0;
    if (type === "smart") return Number(assumptions.smartDimmingSaving);
    return Number(assumptions.smartDimmingSaving) + Number(assumptions.powerAidExtraSaving);
  }

  function recommendProduct(watt) {
    const sorted = [...products].sort((a, b) => Number(a.watt) - Number(b.watt));
    const w = Number(watt);
    if (w >= 180) return sorted.find((p) => Number(p.watt) >= 90) || sorted[sorted.length - 1];
    if (w >= 120) return sorted.find((p) => Number(p.watt) >= 60) || sorted[0];
    if (w >= 70) return sorted.find((p) => Number(p.watt) >= 45) || sorted[0];
    return sorted.find((p) => Number(p.watt) >= 35) || sorted[0];
  }

  const analysed = useMemo(() => {
    return rows.map((row) => {
      const product = recommendProduct(row.existingWatt);
      const beforeKwh = (Number(row.existingWatt) * Number(row.qty) * Number(row.hours)) / 1000;
      const ledKwh = (Number(product.watt) * Number(row.qty) * Number(row.hours)) / 1000;
      const finalKwh = ledKwh * (1 - extraSavingPct(packageType) / 100);

      const energySaving = (beforeKwh - finalKwh) * Number(assumptions.energyPrice);
      const maintenanceSaving = Number(row.qty) * Number(assumptions.maintenanceCost) * Number(assumptions.maintenanceReduction) / 100;
      const serviceFee = Number(row.qty) * packageFee(packageType);
      const annualNetSaving = energySaving + maintenanceSaving - serviceFee;
      const customerCapex = Number(row.qty) * (Number(product.sellPrice) + Number(product.install));
      const internalCost = Number(row.qty) * (Number(product.buyPrice || 0) + Number(product.install));
      const co2 = ((beforeKwh - finalKwh) * Number(assumptions.co2Factor)) / 1000;

      return { ...row, product, beforeKwh, ledKwh, finalKwh, energySaving, maintenanceSaving, serviceFee, annualNetSaving, customerCapex, internalCost, co2 };
    });
  }, [rows, products, assumptions, packageType]);

  const totals = useMemo(() => {
    const total = analysed.reduce(
      (a, r) => {
        a.qty += Number(r.qty);
        a.beforeKwh += r.beforeKwh;
        a.ledKwh += r.ledKwh;
        a.finalKwh += r.finalKwh;
        a.customerCapex += r.customerCapex;
        a.internalCost += r.internalCost;
        a.annualNetSaving += r.annualNetSaving;
        a.energySaving += r.energySaving;
        a.maintenanceSaving += r.maintenanceSaving;
        a.serviceFee += r.serviceFee;
        a.co2 += r.co2;
        return a;
      },
      { qty: 0, beforeKwh: 0, ledKwh: 0, finalKwh: 0, customerCapex: 0, internalCost: 0, annualNetSaving: 0, energySaving: 0, maintenanceSaving: 0, serviceFee: 0, co2: 0 }
    );

    total.payback = total.annualNetSaving > 0 ? total.customerCapex / total.annualNetSaving : 0;
    total.roi = total.customerCapex > 0 ? total.annualNetSaving / total.customerCapex : 0;
    total.netBenefit = total.annualNetSaving * Number(assumptions.years) - total.customerCapex;
    total.energyReductionPct = total.beforeKwh > 0 ? ((total.beforeKwh - total.finalKwh) / total.beforeKwh) * 100 : 0;
    total.margin = total.customerCapex - total.internalCost;
    return total;
  }, [analysed, assumptions]);

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

  async function importCatalogue(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const imported = json
      .map((r, i) => ({
        id: `imported_${Date.now()}_${i}`,
        name: r.Name || r.Product || r.Nome || "Imported product",
        watt: Number(r.Watt || r.W || r.Power || 0),
        sellPrice: Number(r.SellPrice || r.Sell || r.Price || r.Prezzo || 0),
        buyPrice: Number(r.BuyPrice || r.Buy || r.Cost || 0),
        install: Number(r.Install || r.Installation || 35)
      }))
      .filter((p) => p.name && p.watt > 0 && p.sellPrice > 0);

    if (imported.length) setProducts(imported);
    else alert("No valid products found.");
  }

  function exportCSV() {
    const header = "package,area,existingType,existingWatt,qty,hours,recommendedProduct,newWatt,totalCustomerCapex,annualNetSaving,customerRoi,co2";
    const body = analysed.map((r) =>
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
        (totals.roi * 100).toFixed(1) + "%",
        r.co2.toFixed(1)
      ].join(",")
    ).join("\n");

    downloadText("vimalux_customer_roi.csv", header + "\n" + body);
  }

  function exportCatalogue() {
    const header = "Name,Watt,SellPrice,BuyPrice,Install";
    const body = products.map((p) => [p.name, p.watt, p.sellPrice, p.buyPrice || 0, p.install].join(",")).join("\n");
    downloadText("vimalux_product_catalogue.csv", header + "\n" + body);
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetLocal() {
    localStorage.removeItem("vml_rows");
    localStorage.removeItem("vml_products");
    localStorage.removeItem("vml_assumptions");
    setRows(demoRows);
    setProducts(defaultProducts);
    setAssumptions(defaultAssumptions);
    setPackageType("premium");
    setClient("Comune Demo");
  }

  function buildProposalPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    const navy = [7, 17, 31];
    const teal = [73, 163, 156];
    const quoteId = `VMLX-${new Date().toISOString().slice(0, 10)}-${client.replace(/\s+/g, "_").toUpperCase()}`;

    function footer(pageNo) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text("www.vimalux.com", 15, 287);
      doc.text(`${pageNo}`, 195, 287, { align: "right" });
    }

    function addHeader(title, pageNo) {
      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(title, 15, 18);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130);
      doc.text(quoteId, 195, 18, { align: "right" });
      footer(pageNo);
    }

    function money(v) {
      return eur(v).replace("€", "€ ");
    }

    doc.setFillColor(...navy);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text("VIMALUX", 105, 88, { align: "center" });
    doc.setFontSize(16);
    doc.text("PREVENTIVO DI PROGETTO", 105, 116, { align: "center" });
    doc.setFontSize(22);
    doc.text(client.toUpperCase(), 105, 132, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Quotation ID: ${quoteId}`, 105, 150, { align: "center" });
    doc.text("Smart LED · CMS · PowerAiD · Financing-ready proposal", 105, 164, { align: "center" });
    footer("1 / 8");

    doc.addPage();
    addHeader("1. PREVENTIVO DEL PROGETTO", "2 / 8");
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(`La presente proposta preliminare illustra il potenziale tecnico, economico e ambientale per l'aggiornamento dell'infrastruttura di illuminazione esistente di ${client}.`, 180), 15, 34);

    autoTable(doc, {
      startY: 70,
      head: [["Elemento", "Incluso"]],
      body: [
        ["Apparecchi LED VIMALUX", "Sì"],
        ["Sistema Smart CMS", packageType === "led" ? "Opzionale" : "Sì"],
        ["PowerAiD traffic-based dimming", packageType === "premium" ? "Sì" : "Opzionale"],
        ["Installazione", "Sì"],
        ["Garanzia VIMALUX", "Sì"],
        ["Soluzione finanziaria", "Opzionale"],
        ["Calcoli ROI e cashflow", "Sì"]
      ],
      headStyles: { fillColor: teal },
      styles: { fontSize: 9 }
    });

    doc.addPage();
    addHeader("2. ILLUMINAZIONE COME SERVIZIO", "3 / 8");
    autoTable(doc, {
      startY: 30,
      head: [["Chiave del progetto", "Valore"]],
      body: [
        ["Periodo illustrativo", `${assumptions.years} anni`],
        ["Quantità apparecchi", `${num(totals.qty)} pz`],
        ["CAPEX progetto stimato", money(totals.customerCapex)],
        ["Risparmio netto annuo", money(totals.annualNetSaving)],
        ["Payback semplice", `${totals.payback.toFixed(1)} anni`],
        ["ROI annuo cliente", `${(totals.roi * 100).toFixed(1)}%`],
        ["Cashflow netto", money(totals.netBenefit)]
      ],
      headStyles: { fillColor: teal },
      styles: { fontSize: 9 }
    });

    const rowsYears = [];
    let cum = -totals.customerCapex;
    for (let y = 1; y <= Number(assumptions.years); y++) {
      cum += totals.annualNetSaving;
      rowsYears.push([`Year ${y}`, money(totals.annualNetSaving), money(cum)]);
    }

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [["Anno", "Risparmio netto annuo", "Cashflow accumulato"]],
      body: rowsYears,
      headStyles: { fillColor: navy },
      styles: { fontSize: 8 }
    });

    doc.addPage();
    addHeader("3. RIDUZIONE ENERGIA E CO2", "4 / 8");
    autoTable(doc, {
      startY: 30,
      head: [["Parametro", "Risultato"]],
      body: [
        ["Consumo attuale", `${num(totals.beforeKwh)} kWh/anno`],
        ["Consumo futuro stimato", `${num(totals.finalKwh)} kWh/anno`],
        ["Riduzione consumo energetico", `${totals.energyReductionPct.toFixed(1)}%`],
        ["Risparmio energia annuo", money(totals.energySaving)],
        ["Risparmio manutenzione annuo", money(totals.maintenanceSaving)],
        ["Riduzione CO2 annua", `${num(totals.co2)} t`]
      ],
      headStyles: { fillColor: teal },
      styles: { fontSize: 9 }
    });

    doc.addPage();
    addHeader("4. DATI INPUT", "5 / 8");
    autoTable(doc, {
      startY: 30,
      head: [["Area", "Prodotto attuale", "Watt", "PZ", "Ore", "Prodotto VIMALUX", "Nuovo W"]],
      body: analysed.map((r) => [r.area, r.existingType, `${r.existingWatt} W`, num(r.qty), num(r.hours), r.product.name, `${r.product.watt} W`]),
      headStyles: { fillColor: navy },
      styles: { fontSize: 8 }
    });

    doc.addPage();
    addHeader("5. PRODOTTI E TECNOLOGIA", "6 / 8");
    autoTable(doc, {
      startY: 30,
      head: [["Tecnologia", "Descrizione"]],
      body: [
        ["LED ad alta efficienza", "Riduzione immediata dei consumi."],
        ["Smart CMS", "Gestione remota, profili, allarmi e reporting."],
        ["Smart dimming", "Ottimizzazione dei livelli luminosi."],
        ["PowerAiD", "Dimming adattivo basato su traffico."],
        ["Zhaga / D4i readiness", "Architettura interoperabile e future-ready."]
      ],
      headStyles: { fillColor: teal },
      styles: { fontSize: 9 }
    });

    doc.addPage();
    addHeader("6. CERTIFICAZIONI, GARANZIA E NOTE", "7 / 8");
    autoTable(doc, {
      startY: 30,
      head: [["Elemento", "Nota"]],
      body: [
        ["CE", "Prodotti conformi ai requisiti europei applicabili."],
        ["RoHS / RAEE", "Conformità ambientale e gestione fine vita."],
        ["LM79 / LM80", "Riferimenti tecnici per prestazioni e mantenimento del flusso."],
        ["Garanzia VIMALUX", "Copertura secondo condizioni applicabili al progetto."],
        ["ANAC / appalti pubblici", "Da validare secondo struttura contrattuale."],
        ["Finanziamento", "Non costituisce offerta vincolante."]
      ],
      headStyles: { fillColor: navy },
      styles: { fontSize: 9 }
    });

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(doc.splitTextToSize(t.disclaimer, 180), 15, doc.lastAutoTable.finalY + 16);

    doc.addPage();
    addHeader("7. CONTATTI E PROSSIMI PASSI", "8 / 8");
    doc.setTextColor(...navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t.nextSteps, 15, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(t.nextText, 180), 15, 54);

    autoTable(doc, {
      startY: 90,
      head: [["VIMALUX", "Contatti"]],
      body: [
        ["Sales & Finance", "Luciano Grosso · lg@vimalux.com"],
        ["Website", "www.vimalux.com"],
        ["Address", "Betonvej 10, 4000 Roskilde, Denmark"]
      ],
      headStyles: { fillColor: teal },
      styles: { fontSize: 10 }
    });

    doc.save(`${client.replace(/\s+/g, "_")}_VIMALUX_Proposal.pdf`);
  }

  function tryLogin() {
    if (pin === ADMIN_PIN) {
      setAdmin(true);
      setPin("");
      setPage("admin");
    } else {
      alert("Wrong PIN");
    }
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>VIMALUX</div>

        <div style={styles.langWrap}>
          <button style={lang === "EN" ? styles.langActive : styles.langBtn} onClick={() => setLang("EN")}>EN</button>
          <button style={lang === "IT" ? styles.langActive : styles.langBtn} onClick={() => setLang("IT")}>IT</button>
        </div>

        <button style={navStyle(page === "dashboard")} onClick={() => setPage("dashboard")}>{t.dashboard}</button>
        <button style={navStyle(page === "proposal")} onClick={() => setPage("proposal")}>{t.proposal}</button>

        {!admin && (
          <div style={styles.loginBox}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{t.adminLogin}</div>
            <input style={styles.input} type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
            <button style={styles.darkBtnFull} onClick={tryLogin}>{t.adminLogin}</button>
          </div>
        )}

        {admin && (
          <>
            <button style={navStyle(page === "admin")} onClick={() => setPage("admin")}>{t.adminActive}</button>
            <button style={styles.logoutBtn} onClick={() => { setAdmin(false); setPage("dashboard"); }}>{t.logout}</button>
          </>
        )}
      </aside>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>{t.version}</div>
            <h1 style={styles.h1}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>

          <div style={styles.heroActions}>
            <button style={styles.whiteBtn} onClick={exportCSV}>{t.export}</button>
            <button style={styles.whiteBtn} onClick={buildProposalPDF}>{t.print}</button>
          </div>
        </section>

        <section style={styles.uploadCard}>
          <label style={styles.uploadBox}>
            <input type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display: "none" }} />
            <b>{t.upload}</b>
            <span>ProjectInputSheet / ProjectInputSheet_ITA</span>
          </label>

          <button style={styles.darkBtn} onClick={() => { setRows(demoRows); setClient("Comune Demo"); setPackageType("premium"); }}>
            {t.demo}
          </button>
        </section>

        <section style={styles.card}>
          <h2>{t.solution}</h2>
          <div style={styles.packageGrid}>
            <button style={packageStyle(packageType === "led")} onClick={() => setPackageType("led")}>{t.led}</button>
            <button style={packageStyle(packageType === "smart")} onClick={() => setPackageType("smart")}>{t.smart}</button>
            <button style={packageStyle(packageType === "premium")} onClick={() => setPackageType("premium")}>{t.premium}</button>
          </div>
        </section>

        <section style={styles.kpiGrid}>
          <Kpi title={t.client} value={client} />
          <Kpi title={t.solution} value={packageName(packageType)} />
          <Kpi title={t.totalLamps} value={num(totals.qty)} />
          <Kpi title={t.capex} value={eur(totals.customerCapex)} />
          <Kpi title={t.annualSaving} value={eur(totals.annualNetSaving)} />
          <Kpi title={t.payback} value={`${totals.payback.toFixed(1)} years`} />
          <Kpi title={t.roi} value={`${(totals.roi * 100).toFixed(1)}%`} />
          <Kpi title={t.netBenefit} value={eur(totals.netBenefit)} />
          <Kpi title={t.co2} value={`${num(totals.co2)} t`} />
        </section>

        {admin && (
          <section style={styles.adminKpis}>
            <Kpi title="Internal CAPEX" value={eur(totals.internalCost)} />
            <Kpi title="Gross margin proxy" value={eur(totals.margin)} />
            <Kpi title="Annual SaaS/PowerAiD fee" value={eur(totals.serviceFee)} />
          </section>
        )}

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
            <p style={styles.largeText}>VIMALUX has analysed <b>{num(totals.qty)}</b> luminaires for <b>{client}</b>.</p>
            <p style={styles.largeText}>The selected solution is <b>{packageName(packageType)}</b>. Estimated project CAPEX is <b>{eur(totals.customerCapex)}</b>.</p>
            <p style={styles.largeText}>Annual net saving is <b>{eur(totals.annualNetSaving)}</b>, ROI is <b>{(totals.roi * 100).toFixed(1)}%</b>, and payback is <b>{totals.payback.toFixed(1)} years</b>.</p>
            <p style={styles.note}>{t.disclaimer}</p>
            <button style={styles.darkBtn} onClick={buildProposalPDF}>{t.print}</button>
          </Card>
        )}

        {admin && page === "admin" && (
          <AdminPanel
            t={t}
            products={products}
            setProducts={setProducts}
            assumptions={assumptions}
            setAssumptions={setAssumptions}
            importCatalogue={importCatalogue}
            exportCatalogue={exportCatalogue}
            resetLocal={resetLocal}
          />
        )}
      </main>
    </div>
  );
}

function AdminPanel({ t, products, setProducts, assumptions, setAssumptions, importCatalogue, exportCatalogue, resetLocal }) {
  function updateProduct(id, field, value) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, [field]: value } : p));
  }

  function addProduct() {
    setProducts((prev) => [...prev, { id: `p_${Date.now()}`, name: "New Product", watt: 60, sellPrice: 150, buyPrice: 100, install: 35 }]);
  }

  function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <>
      <Card title={t.assumptions}>
        <div style={styles.formGrid}>
          {Object.entries(assumptions).map(([k, v]) => (
            <label key={k} style={styles.label}>
              {k}
              <input style={styles.input} type="number" step="0.01" value={v} onChange={(e) => setAssumptions({ ...assumptions, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
      </Card>

      <Card title={t.products}>
        <div style={styles.adminTools}>
          <button style={styles.darkBtn} onClick={addProduct}>{t.addProduct}</button>
          <button style={styles.darkBtn} onClick={() => setProducts(defaultProducts)}>{t.reset}</button>
          <button style={styles.darkBtn} onClick={exportCatalogue}>{t.exportCatalog}</button>
          <button style={styles.dangerBtn} onClick={resetLocal}>{t.clear}</button>
          <label style={styles.darkBtn}>
            {t.importCatalog}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importCatalogue} style={{ display: "none" }} />
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Name", "Watt", "Sell €", "Buy €", "Install €", "Unit CAPEX", "Margin/unit", "Action"].map((h) => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}><input style={styles.input} value={p.name} onChange={(e) => updateProduct(p.id, "name", e.target.value)} /></td>
                  <td style={styles.td}><input style={styles.input} type="number" value={p.watt} onChange={(e) => updateProduct(p.id, "watt", Number(e.target.value))} /></td>
                  <td style={styles.td}><input style={styles.input} type="number" value={p.sellPrice} onChange={(e) => updateProduct(p.id, "sellPrice", Number(e.target.value))} /></td>
                  <td style={styles.td}><input style={styles.input} type="number" value={p.buyPrice || 0} onChange={(e) => updateProduct(p.id, "buyPrice", Number(e.target.value))} /></td>
                  <td style={styles.td}><input style={styles.input} type="number" value={p.install} onChange={(e) => updateProduct(p.id, "install", Number(e.target.value))} /></td>
                  <td style={styles.td}><b>{eur(Number(p.sellPrice) + Number(p.install))}</b></td>
                  <td style={styles.td}><b>{eur(Number(p.sellPrice) - Number(p.buyPrice || 0))}</b></td>
                  <td style={styles.td}><button style={styles.dangerBtn} onClick={() => deleteProduct(p.id)}>{t.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
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
  app: { minHeight: "100vh", display: "grid", gridTemplateColumns: "250px 1fr", background: "#f4f6f8", color: "#0b1220", fontFamily: "Arial, sans-serif" },
  sidebar: { background: "white", padding: 24, borderRight: "1px solid #e2e8f0" },
  logo: { fontWeight: 900, letterSpacing: "0.14em", marginBottom: 20, fontSize: 22 },
  langWrap: { display: "flex", gap: 8, marginBottom: 22 },
  langBtn: { background: "#e2e8f0", color: "#0f172a", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  langActive: { background: "#0f172a", color: "white", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  loginBox: { marginTop: 24, background: "#f8fafc", borderRadius: 16, padding: 14 },
  main: { padding: 32, overflowX: "hidden" },
  hero: { background: "#07111f", color: "white", borderRadius: 28, padding: 36, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 24 },
  heroActions: { display: "flex", gap: 10 },
  eyebrow: { color: "#93c5fd", letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" },
  h1: { fontSize: 46, margin: "12px 0" },
  subtitle: { color: "#dbeafe", fontSize: 18 },
  whiteBtn: { background: "white", color: "#0f172a", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  darkBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer", display: "inline-block" },
  darkBtnFull: { marginTop: 10, width: "100%", background: "#0f172a", color: "white", border: 0, borderRadius: 12, padding: "11px 12px", fontWeight: 900, cursor: "pointer" },
  dangerBtn: { background: "#dc2626", color: "white", border: 0, borderRadius: 12, padding: "11px 13px", fontWeight: 900, cursor: "pointer" },
  logoutBtn: { width: "100%", background: "#dc2626", color: "white", border: 0, borderRadius: 14, padding: "14px 16px", fontWeight: 900, cursor: "pointer", marginTop: 8 },
  uploadCard: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 24, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" },
  uploadBox: { minWidth: 320, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", border: "2px dashed #cbd5e1", borderRadius: 20, padding: 28, cursor: "pointer", background: "#f8fafc" },
  packageGrid: { display: "flex", gap: 12, flexWrap: "wrap" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  adminKpis: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  kpi: { background: "white", borderRadius: 22, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 16 },
  kpiTitle: { color: "#64748b", fontSize: 14 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 10 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 24, overflow: "hidden" },
  compareTop: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  barBg: { background: "#e2e8f0", borderRadius: 999, height: 18 },
  bar: { background: "#0f172a", height: 18, borderRadius: 999 },
  note: { background: "#f1f5f9", borderRadius: 18, padding: 16, color: "#475569", lineHeight: 1.5 },
  largeText: { fontSize: 18, color: "#334155", lineHeight: 1.6 },
  input: { width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  label: { display: "flex", flexDirection: "column", gap: 8, fontWeight: 800, color: "#475569" },
  adminTools: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1100 },
  th: { textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0", color: "#64748b" },
  td: { padding: 8, borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }
};
