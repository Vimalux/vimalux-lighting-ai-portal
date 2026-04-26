import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";

const defaultProducts = [
  { id: "urban45", name: "VIMALUX Urban 45W Smart", watt: 45, lumen: 7650, sellPrice: 135, install: 45, category: "Urban", zhaga: "Yes", d4i: "Yes" },
  { id: "street60", name: "VIMALUX Street Pro 60W Smart", watt: 60, lumen: 10200, sellPrice: 150, install: 45, category: "Street", zhaga: "Yes", d4i: "Yes" },
  { id: "main90", name: "VIMALUX Main Road 90W Smart", watt: 90, lumen: 15300, sellPrice: 185, install: 50, category: "Main Road", zhaga: "Yes", d4i: "Yes" },
  { id: "decor35", name: "VIMALUX Decorative Retrofit 35W Smart", watt: 35, lumen: 5600, sellPrice: 120, install: 50, category: "Decorative", zhaga: "Optional", d4i: "Yes" }
];

const defaultAssumptions = {
  energyPrice: 0.29,
  maintenanceCost: 25,
  maintenanceReduction: 75,
  smartDimmingSaving: 22,
  powerAidExtraSaving: 8,
  years: 15,
  co2Factor: 0.35
};

const demoRows = [
  { id: 1, area: "Main roads", existingType: "HPS 150W", existingWatt: 150, qty: 320, hours: 4200 },
  { id: 2, area: "Urban roads", existingType: "HPS 120W", existingWatt: 120, qty: 500, hours: 4200 }
];

const packs = {
  led: { fee: 0 },
  smart: { fee: 6 },
  premium: { fee: 9 }
};

const labels = {
  EN: {
    version: "VIMALUX LIGHTING AI PORTAL · VERSION 9C",
    title: "Customer ROI Closing Engine",
    subtitle: "Customer-facing LED vs Smart vs Smart + PowerAiD ROI comparison.",
    importExcel: "Import Excel",
    dashboard: "Customer Dashboard",
    inventory: "Inventory",
    products: "Products / Prices",
    assumptions: "Assumptions",
    proposal: "Proposal",
    packages: "Packages",
    export: "Export Analysis",
    print: "Print / PDF",
    client: "Client",
    totalLamps: "Total lamps",
    projectCapex: "Total project CAPEX",
    annualNetSaving: "Annual net saving",
    payback: "Simple payback",
    roi: "Customer ROI/year",
    netBenefit: "Net benefit",
    co2: "CO₂ saving/year",
    annualFee: "Annual service fee",
    package: "Commercial package",
    ledOnly: "LED only",
    smart: "Smart Platform",
    premium: "Smart + PowerAiD",
    uploadTitle: "Upload VIMALUX audit sheet",
    uploadMain: "Click to upload Excel audit sheet",
    uploadInfo1: "Reads ProjectInputSheet / ProjectInputSheet_ITA.",
    uploadInfo2: "Uses Location B, Type C, Qty D, Watt G, Hours I.",
    loadDemo: "Load demo",
    editPrices: "Edit product prices",
    status: "Customer business case",
    inventoryRows: "Inventory rows",
    catalogueProducts: "Products in catalogue",
    uploadNote: "Upload audit sheet first. Then adjust package, prices and assumptions before generating proposal.",
    energyComparison: "Energy comparison",
    existingSystem: "Existing system",
    newSystem: "New system",
    valueCreation: "Customer value creation",
    energySavingYear: "Energy saving/year",
    maintenanceSavingYear: "Maintenance saving/year",
    serviceOpexYear: "Smart service fee/year",
    inventoryTitle: "Imported inventory and automatic product matching",
    productTitle: "Product catalogue and customer pricing",
    addProduct: "+ Add product",
    resetCatalogue: "Reset catalogue",
    clearLocal: "Clear local data",
    duplicate: "Duplicate",
    delete: "Delete",
    resetDone: "Catalogue reset to default products.",
    clearDone: "Local browser data cleared.",
    catalogueNote: "Only customer-facing sales prices are shown. Internal purchase prices and margins are intentionally excluded.",
    assumptionsTitle: "Customer assumptions control center",
    proposalSummary: "Customer proposal summary for",
    preliminary: "Preliminary and non-binding. Final offer depends on technical audit, lighting design, product confirmation, installation conditions, contract structure and financing approval.",
    noRows: "No valid VIMALUX audit rows found. Check quantity in column D and wattage in column G."
  },
  IT: {
    version: "VIMALUX LIGHTING AI PORTAL · VERSIONE 9C",
    title: "Motore ROI Cliente",
    subtitle: "Confronto ROI cliente tra LED, Smart e Smart + PowerAiD.",
    importExcel: "Importa Excel",
    dashboard: "Dashboard Cliente",
    inventory: "Inventario",
    products: "Prodotti / Prezzi",
    assumptions: "Assunzioni",
    proposal: "Proposta",
    packages: "Pacchetti",
    export: "Esporta Analisi",
    print: "Stampa / PDF",
    client: "Cliente",
    totalLamps: "Totale lampade",
    projectCapex: "CAPEX totale progetto",
    annualNetSaving: "Risparmio netto annuo",
    payback: "Payback semplice",
    roi: "ROI cliente/anno",
    netBenefit: "Beneficio netto",
    co2: "Risparmio CO₂/anno",
    annualFee: "Canone servizio annuo",
    package: "Pacchetto commerciale",
    ledOnly: "Solo LED",
    smart: "Piattaforma Smart",
    premium: "Smart + PowerAiD",
    uploadTitle: "Carica audit sheet VIMALUX",
    uploadMain: "Clicca per caricare Excel audit sheet",
    uploadInfo1: "Legge ProjectInputSheet / ProjectInputSheet_ITA.",
    uploadInfo2: "Usa Località B, Tipo C, Quantità D, Watt G, Ore I.",
    loadDemo: "Carica demo",
    editPrices: "Modifica prezzi prodotti",
    status: "Business case cliente",
    inventoryRows: "Righe inventario",
    catalogueProducts: "Prodotti in catalogo",
    uploadNote: "Carica prima l’audit sheet. Poi modifica pacchetto, prezzi e assunzioni prima di generare la proposta.",
    energyComparison: "Confronto energia",
    existingSystem: "Sistema esistente",
    newSystem: "Nuovo sistema",
    valueCreation: "Creazione valore cliente",
    energySavingYear: "Risparmio energia/anno",
    maintenanceSavingYear: "Risparmio manutenzione/anno",
    serviceOpexYear: "Canone servizio Smart/anno",
    inventoryTitle: "Inventario importato e matching automatico prodotto",
    productTitle: "Catalogo prodotti e prezzi cliente",
    addProduct: "+ Aggiungi prodotto",
    resetCatalogue: "Reset catalogo",
    clearLocal: "Cancella dati locali",
    duplicate: "Duplica",
    delete: "Elimina",
    resetDone: "Catalogo ripristinato ai prodotti default.",
    clearDone: "Dati locali browser cancellati.",
    catalogueNote: "Sono mostrati solo i prezzi di vendita al cliente. Prezzi di acquisto e margini interni sono esclusi intenzionalmente.",
    assumptionsTitle: "Centro controllo assunzioni cliente",
    proposalSummary: "Sintesi proposta cliente per",
    preliminary: "Preliminare e non vincolante. Offerta finale soggetta ad audit tecnico, lighting design, conferma prodotto, condizioni installative, struttura contrattuale e approvazione finanziaria.",
    noRows: "Nessuna riga audit VIMALUX valida trovata. Verificare quantità in colonna D e wattaggio in colonna G."
  }
};

function eur(v) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
}

function num(v) {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(v || 0);
}

export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("vml_lang_v9c") || "EN");
  const t = labels[lang];

  const [page, setPage] = useState("dashboard");
  const [packageType, setPackageType] = useState(() => localStorage.getItem("vml_package_v9c") || "premium");
  const [client, setClient] = useState("Comune Demo");
  const [statusMsg, setStatusMsg] = useState("");
  const [products, setProducts] = useState(() => JSON.parse(localStorage.getItem("vml_products_v9c") || "null") || defaultProducts);
  const [assumptions, setAssumptions] = useState(() => JSON.parse(localStorage.getItem("vml_assumptions_v9c") || "null") || defaultAssumptions);
  const [rows, setRows] = useState(() => JSON.parse(localStorage.getItem("vml_rows_v9c") || "null") || demoRows);

  useEffect(() => localStorage.setItem("vml_lang_v9c", lang), [lang]);
  useEffect(() => localStorage.setItem("vml_package_v9c", packageType), [packageType]);
  useEffect(() => localStorage.setItem("vml_products_v9c", JSON.stringify(products)), [products]);
  useEffect(() => localStorage.setItem("vml_assumptions_v9c", JSON.stringify(assumptions)), [assumptions]);
  useEffect(() => localStorage.setItem("vml_rows_v9c", JSON.stringify(rows)), [rows]);

  function flash(message) {
    setStatusMsg(message);
    setTimeout(() => setStatusMsg(""), 2500);
  }

  function packageName(type) {
    if (type === "led") return t.ledOnly;
    if (type === "smart") return t.smart;
    return t.premium;
  }

  function packageFee(type) {
    return packs[type]?.fee || 0;
  }

  function extraSavingPct(type) {
    if (type === "led") return 0;
    if (type === "smart") return Number(assumptions.smartDimmingSaving);
    return Number(assumptions.smartDimmingSaving) + Number(assumptions.powerAidExtraSaving);
  }

  function recommendProduct(watt) {
    const sorted = [...products].sort((a, b) => Number(a.watt) - Number(b.watt));
    const w = Number(watt);
    if (w >= 180) return products.find(p => p.id === "main90") || sorted[sorted.length - 1];
    if (w >= 120) return products.find(p => p.id === "street60") || sorted.find(p => p.watt >= 60) || sorted[0];
    if (w >= 70) return products.find(p => p.id === "urban45") || sorted.find(p => p.watt >= 45) || sorted[0];
    return products.find(p => p.id === "decor35") || sorted[0];
  }

  const analysed = useMemo(() => {
    return rows.map(row => {
      const product = recommendProduct(row.existingWatt);
      const beforeKwh = Number(row.existingWatt) * Number(row.qty) * Number(row.hours) / 1000;
      const ledKwh = Number(product.watt) * Number(row.qty) * Number(row.hours) / 1000;
      const savingPct = extraSavingPct(packageType);
      const finalKwh = ledKwh * (1 - savingPct / 100);

      const energySaving = (beforeKwh - finalKwh) * Number(assumptions.energyPrice);
      const maintenanceSaving = Number(row.qty) * Number(assumptions.maintenanceCost) * Number(assumptions.maintenanceReduction) / 100;
      const serviceFee = Number(row.qty) * packageFee(packageType);

      const annualNetSaving = energySaving + maintenanceSaving - serviceFee;
      const customerCapex = Number(row.qty) * (Number(product.sellPrice) + Number(product.install));
      const payback = annualNetSaving > 0 ? customerCapex / annualNetSaving : 0;
      const roi = customerCapex > 0 ? annualNetSaving / customerCapex : 0;
      const co2 = (beforeKwh - finalKwh) * Number(assumptions.co2Factor) / 1000;

      return {
        ...row,
        product,
        beforeKwh,
        ledKwh,
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
  }, [rows, products, assumptions, packageType]);

  const totals = useMemo(() => {
    const t = analysed.reduce((a, r) => {
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
    }, {
      qty: 0,
      beforeKwh: 0,
      finalKwh: 0,
      customerCapex: 0,
      annualNetSaving: 0,
      energySaving: 0,
      maintenanceSaving: 0,
      serviceFee: 0,
      co2: 0
    });

    t.payback = t.annualNetSaving > 0 ? t.customerCapex / t.annualNetSaving : 0;
    t.roi = t.customerCapex > 0 ? t.annualNetSaving / t.customerCapex : 0;
    t.netBenefit = t.annualNetSaving * Number(assumptions.years) - t.customerCapex;
    return t;
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
        .filter(r => r.qty > 0 && r.existingWatt > 0);

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

  function updateProduct(id, field, value) {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function addProduct() {
    setProducts(prev => [...prev, {
      id: `product_${Date.now()}`,
      name: "New Smart LED Product",
      watt: 60,
      lumen: 10000,
      sellPrice: 150,
      install: 45,
      category: "New Category",
      zhaga: "Yes",
      d4i: "Yes"
    }]);
  }

  function duplicateProduct(product) {
    setProducts(prev => [...prev, {
      ...product,
      id: `product_${Date.now()}`,
      name: `${product.name} Copy`
    }]);
  }

  function deleteProduct(id) {
    if (products.length <= 1) {
      alert("You must keep at least one product.");
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  function resetCatalogue() {
    setProducts(defaultProducts);
    flash(t.resetDone);
  }

  function clearLocalData() {
    localStorage.removeItem("vml_products_v9c");
    localStorage.removeItem("vml_assumptions_v9c");
    localStorage.removeItem("vml_rows_v9c");
    localStorage.removeItem("vml_package_v9c");
    setProducts(defaultProducts);
    setAssumptions(defaultAssumptions);
    setRows(demoRows);
    setPackageType("premium");
    setClient("Comune Demo");
    flash(t.clearDone);
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function exportAnalysis() {
    const header = "package,area,existingType,existingWatt,qty,hours,recommendedProduct,newWatt,totalCustomerCapex,annualServiceFee,annualNetSaving,payback,customerRoi,co2";
    const body = analysed.map(r => [
      packageName(packageType),
      r.area,
      r.existingType,
      r.existingWatt,
      r.qty,
      r.hours,
      r.product.name,
      r.product.watt,
      Math.round(r.customerCapex),
      Math.round(r.serviceFee),
      Math.round(r.annualNetSaving),
      r.payback.toFixed(1),
      (r.roi * 100).toFixed(1) + "%",
      r.co2.toFixed(1)
    ].join(",")).join("\n");

    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vimalux_customer_roi_v9c.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetDemo() {
    setRows(demoRows);
    setClient("Comune Demo");
  }

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>VIMALUX</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button style={lang === "EN" ? styles.langActive : styles.langBtn} onClick={() => setLang("EN")}>EN</button>
          <button style={lang === "IT" ? styles.langActive : styles.langBtn} onClick={() => setLang("IT")}>IT</button>
        </div>

        <Nav label={t.importExcel} id="import" page={page} setPage={setPage} />
        <Nav label={t.dashboard} id="dashboard" page={page} setPage={setPage} />
        <Nav label={t.packages} id="packages" page={page} setPage={setPage} />
        <Nav label={t.inventory} id="inventory" page={page} setPage={setPage} />
        <Nav label={t.products} id="products" page={page} setPage={setPage} />
        <Nav label={t.assumptions} id="assumptions" page={page} setPage={setPage} />
        <Nav label={t.proposal} id="proposal" page={page} setPage={setPage} />
      </aside>

      <main style={styles.main}>
        <section style={styles.hero}>
          <div>
            <div style={styles.eyebrow}>{t.version}</div>
            <h1 style={styles.h1}>{t.title}</h1>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.whiteBtn} onClick={exportAnalysis}>{t.export}</button>
            <button style={styles.whiteBtn} onClick={() => window.print()}>{t.print}</button>
          </div>
        </section>

        {statusMsg && <div style={styles.status}>{statusMsg}</div>}

        <PackageSelector t={t} packageType={packageType} setPackageType={setPackageType} />

        <section style={styles.kpiGrid}>
          <Kpi title={t.client} value={client} />
          <Kpi title={t.package} value={packageName(packageType)} />
          <Kpi title={t.totalLamps} value={num(totals.qty)} />
          <Kpi title={t.projectCapex} value={eur(totals.customerCapex)} />
          <Kpi title={t.annualNetSaving} value={eur(totals.annualNetSaving)} />
          <Kpi title={t.payback} value={`${totals.payback.toFixed(1)} years`} />
          <Kpi title={t.roi} value={`${(totals.roi * 100).toFixed(1)}%`} />
          <Kpi title={t.annualFee} value={eur(totals.serviceFee)} />
          <Kpi title={t.co2} value={`${num(totals.co2)} t`} />
        </section>

        {page === "import" && (
          <section style={styles.grid2}>
            <Card title={t.uploadTitle}>
              <label style={styles.uploadBox}>
                <input type="file" accept=".xlsx,.xls" onChange={importExcel} style={{ display: "none" }} />
                <b>{t.uploadMain}</b>
                <span>{t.uploadInfo1}</span>
                <span>{t.uploadInfo2}</span>
              </label>
              <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                <button style={styles.darkBtn} onClick={resetDemo}>{t.loadDemo}</button>
                <button style={styles.darkBtn} onClick={() => setPage("products")}>{t.editPrices}</button>
              </div>
            </Card>

            <Card title={t.status}>
              <Kpi title={t.inventoryRows} value={rows.length} />
              <Kpi title={t.catalogueProducts} value={products.length} />
              <Kpi title={`${assumptions.years}Y ${t.netBenefit}`} value={eur(totals.netBenefit)} />
              <Kpi title={t.co2} value={`${num(totals.co2)} t`} />
              <p style={styles.note}>{t.uploadNote}</p>
            </Card>
          </section>
        )}

        {(page === "dashboard" || page === "packages") && (
          <section style={styles.grid2}>
            <Card title={t.energyComparison}>
              <Compare label={t.existingSystem} value={totals.beforeKwh} max={totals.beforeKwh} />
              <Compare label={t.newSystem} value={totals.finalKwh} max={totals.beforeKwh} />
              <p style={styles.note}>
                Energy price: {assumptions.energyPrice} €/kWh. Extra saving: {extraSavingPct(packageType)}%.
              </p>
            </Card>

            <Card title={t.valueCreation}>
              <Kpi title={t.energySavingYear} value={eur(totals.energySaving)} />
              <Kpi title={t.maintenanceSavingYear} value={eur(totals.maintenanceSaving)} />
              <Kpi title={t.serviceOpexYear} value={eur(totals.serviceFee)} />
              <Kpi title={`${assumptions.years}Y ${t.netBenefit}`} value={eur(totals.netBenefit)} />
            </Card>
          </section>
        )}

        {page === "inventory" && (
          <Card title={t.inventoryTitle}>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Area", "Existing type", "Old W", "Qty", "Hours", "Recommended", "New W", "Customer CAPEX", "Service fee", "Net saving", "Payback"].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysed.map(r => (
                    <tr key={r.id}>
                      <td style={styles.td}><input style={styles.input} value={r.area} onChange={e => updateRow(r.id, "area", e.target.value)} /></td>
                      <td style={styles.td}><input style={styles.input} value={r.existingType} onChange={e => updateRow(r.id, "existingType", e.target.value)} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={r.existingWatt} onChange={e => updateRow(r.id, "existingWatt", Number(e.target.value))} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={r.qty} onChange={e => updateRow(r.id, "qty", Number(e.target.value))} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={r.hours} onChange={e => updateRow(r.id, "hours", Number(e.target.value))} /></td>
                      <td style={styles.td}>{r.product.name}</td>
                      <td style={styles.td}>{r.product.watt}W</td>
                      <td style={styles.td}>{eur(r.customerCapex)}</td>
                      <td style={styles.td}>{eur(r.serviceFee)}</td>
                      <td style={styles.td}><b>{eur(r.annualNetSaving)}</b></td>
                      <td style={styles.td}>{r.payback.toFixed(1)}y</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {page === "products" && (
          <Card title={t.productTitle}>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <button style={styles.darkBtn} onClick={addProduct}>{t.addProduct}</button>
              <button style={styles.darkBtn} onClick={resetCatalogue}>{t.resetCatalogue}</button>
              <button style={styles.deleteBtn} onClick={clearLocalData}>{t.clearLocal}</button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {["Name", "Category", "Watt", "Lumen", "Sell €", "Install €", "Unit CAPEX €", "Zhaga", "D4i", "Actions"].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td style={styles.td}><input style={styles.input} value={p.name} onChange={e => updateProduct(p.id, "name", e.target.value)} /></td>
                      <td style={styles.td}><input style={styles.input} value={p.category} onChange={e => updateProduct(p.id, "category", e.target.value)} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={p.watt} onChange={e => updateProduct(p.id, "watt", Number(e.target.value))} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={p.lumen} onChange={e => updateProduct(p.id, "lumen", Number(e.target.value))} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={p.sellPrice} onChange={e => updateProduct(p.id, "sellPrice", Number(e.target.value))} /></td>
                      <td style={styles.td}><input style={styles.input} type="number" value={p.install} onChange={e => updateProduct(p.id, "install", Number(e.target.value))} /></td>
                      <td style={styles.td}><b>{eur(Number(p.sellPrice) + Number(p.install))}</b></td>
                      <td style={styles.td}><input style={styles.input} value={p.zhaga} onChange={e => updateProduct(p.id, "zhaga", e.target.value)} /></td>
                      <td style={styles.td}><input style={styles.input} value={p.d4i} onChange={e => updateProduct(p.id, "d4i", e.target.value)} /></td>
                      <td style={styles.td}>
                        <button style={styles.smallBtn} onClick={() => duplicateProduct(p)}>{t.duplicate}</button>
                        <button style={styles.deleteBtn} onClick={() => deleteProduct(p.id)}>{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={styles.note}>{t.catalogueNote}</p>
          </Card>
        )}

        {page === "assumptions" && (
          <Card title={t.assumptionsTitle}>
            <div style={styles.formGrid}>
              {Object.entries(assumptions).map(([key, value]) => (
                <NumberInput key={key} label={prettyLabel(key)} value={value} step="0.01" onChange={v => setAssumptions({ ...assumptions, [key]: Number(v) })} />
              ))}
            </div>
          </Card>
        )}

        {page === "proposal" && (
          <Card title={`${t.proposalSummary} ${client}`}>
            <p style={styles.largeText}>
              VIMALUX has analysed <b>{num(totals.qty)}</b> luminaires. The selected package is <b>{packageName(packageType)}</b>.
            </p>
            <p style={styles.largeText}>
              Total customer CAPEX is <b>{eur(totals.customerCapex)}</b>. Estimated annual net saving is <b>{eur(totals.annualNetSaving)}</b>, equal to a customer ROI of <b>{(totals.roi * 100).toFixed(1)}%</b> per year and a simple payback of <b>{totals.payback.toFixed(1)} years</b>.
            </p>
            <p style={styles.largeText}>
              Over <b>{assumptions.years}</b> years, estimated net customer benefit is <b>{eur(totals.netBenefit)}</b>, with annual CO₂ reduction of <b>{num(totals.co2)} t</b>.
            </p>
            <p style={styles.note}>{t.preliminary}</p>
            <button style={styles.darkBtn} onClick={() => window.print()}>{t.print}</button>
          </Card>
        )}
      </main>
    </div>
  );
}

function prettyLabel(key) {
  const map = {
    energyPrice: "Energy price €/kWh",
    maintenanceCost: "Maintenance cost €/lamp/year",
    maintenanceReduction: "Maintenance reduction %",
    smartDimmingSaving: "Smart dimming saving %",
    powerAidExtraSaving: "PowerAiD extra saving %",
    years: "Analysis years",
    co2Factor: "CO₂ factor kg/kWh"
  };
  return map[key] || key;
}

function PackageSelector({ t, packageType, setPackageType }) {
  const b = (type) => ({
    padding: "14px 18px",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 15,
    background: packageType === type ? "#0f172a" : "#e2e8f0",
    color: packageType === type ? "white" : "#0f172a"
  });

  return (
    <section style={styles.card}>
      <h2 style={{ marginTop: 0 }}>{t.package}</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button style={b("led")} onClick={() => setPackageType("led")}>{t.ledOnly}</button>
        <button style={b("smart")} onClick={() => setPackageType("smart")}>{t.smart}</button>
        <button style={b("premium")} onClick={() => setPackageType("premium")}>{t.premium}</button>
      </div>
    </section>
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

function Compare({ label, value, max }) {
  const width = Math.max(5, (Number(value) / Math.max(Number(max), 1)) * 100);
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
  logo: { fontWeight: 900, letterSpacing: "0.14em", marginBottom: 20, fontSize: 20 },
  langBtn: { background: "#e2e8f0", color: "#0f172a", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  langActive: { background: "#0f172a", color: "white", border: 0, borderRadius: 10, padding: "8px 12px", fontWeight: 900, cursor: "pointer" },
  main: { padding: 32 },
  hero: { background: "#07111f", color: "white", borderRadius: 28, padding: 36, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 24 },
  eyebrow: { color: "#93c5fd", letterSpacing: "0.16em", fontSize: 12, textTransform: "uppercase" },
  h1: { fontSize: 46, margin: "12px 0" },
  subtitle: { color: "#dbeafe", fontSize: 18 },
  whiteBtn: { background: "white", color: "#0f172a", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  darkBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 14, padding: "13px 18px", fontWeight: 900, cursor: "pointer" },
  smallBtn: { background: "#0f172a", color: "white", border: 0, borderRadius: 10, padding: "8px 10px", fontWeight: 800, cursor: "pointer", marginRight: 6 },
  deleteBtn: { background: "#dc2626", color: "white", border: 0, borderRadius: 10, padding: "8px 10px", fontWeight: 800, cursor: "pointer" },
  status: { background: "#dcfce7", color: "#166534", padding: 14, borderRadius: 14, fontWeight: 900, marginBottom: 18 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  kpi: { background: "white", borderRadius: 22, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 16 },
  kpiTitle: { color: "#64748b", fontSize: 14 },
  kpiValue: { fontSize: 28, fontWeight: 900, marginTop: 10 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card: { background: "white", borderRadius: 24, padding: 24, boxShadow: "0 8px 24px rgba(15,23,42,.06)", marginBottom: 24 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 },
  label: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 800, color: "#475569" },
  input: { width: "100%", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 12, fontSize: 14 },
  uploadBox: { display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", border: "2px dashed #cbd5e1", borderRadius: 20, padding: 40, cursor: "pointer", background: "#f8fafc" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 1450 },
  th: { textAlign: "left", padding: 10, color: "#64748b", fontSize: 12, borderBottom: "1px solid #e2e8f0" },
  td: { padding: 8, borderBottom: "1px solid #e2e8f0", verticalAlign: "middle" },
  note: { background: "#f1f5f9", borderRadius: 18, padding: 16, color: "#475569", lineHeight: 1.5 },
  largeText: { fontSize: 18, color: "#334155", lineHeight: 1.6 }
};
