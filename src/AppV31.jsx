import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  calculateManualProject,
  createManualGroup,
} from "./v31ManualProjectEngine";

const DEFAULT_PRODUCTS = [
  { id: "street60", name: "VIMALUX Street 60", watt: 60, sellPrice: 190, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, sellPrice: 210, buyPrice: 150, install: 35 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, sellPrice: 285, buyPrice: 205, install: 45 },
];

const DEFAULT_ASSUMPTIONS = {
  ledSavingPct: 55,
  cloSavingPct: 10,
  smartSolutionSavingPct: 20,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  powerAidAdditionalSavingPct: 35,
  energyPrice: 0.29,
  burningHours: 4200,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  hybridProductionKwhPerLampYear: 70,
  hybridAdditionalCapexPerLamp: 0,
};

const TEXT = {
  it: {
    title: "VIMALUX Lighting AI Portal",
    version: "Versione 31 – Manual Project Builder",
    customer: "Dashboard Cliente",
    admin: "Admin",
    quick: "Stima rapida",
    manual: "Progetto manuale",
    audit: "Import Audit",
    project: "Progetto",
    municipality: "Comune",
    contact: "Contatto",
    quantity: "Quantità",
    existingWatt: "Watt esistente",
    product: "Nuovo prodotto",
    addGroup: "+ Aggiungi gruppo",
    duplicate: "Duplica",
    remove: "Elimina",
    group: "Gruppo",
    existingType: "Tecnologia esistente",
    smart: "Smart",
    powerAid: "PowerAiD",
    hybrid: "Hybrid",
    annualSaving: "Risparmio annuo netto",
    capex: "CAPEX",
    payback: "Payback",
    energyReduction: "Riduzione energetica",
    baseline: "Consumo baseline",
    energySaving: "Risparmio energia",
    maintenance: "Risparmio manutenzione",
    opex: "OPEX ricorrente",
    importAudit: "Importa Audit Sheet",
    importCatalog: "Importa catalogo prodotti",
    assumptions: "Assunzioni",
    catalogue: "Catalogo prodotti",
    customerNote: "I prezzi e le assunzioni interne sono visibili solo in Admin.",
    emptyAudit: "Importa il template VIMALUX. Vengono lette solo le righe 1–29: colonna D quantità e colonna G watt.",
    imported: "Audit importato",
    save: "Aggiornamento automatico",
  },
  en: {
    title: "VIMALUX Lighting AI Portal",
    version: "Version 31 – Manual Project Builder",
    customer: "Customer Dashboard",
    admin: "Admin",
    quick: "Quick estimate",
    manual: "Manual project",
    audit: "Audit import",
    project: "Project",
    municipality: "Municipality",
    contact: "Contact",
    quantity: "Quantity",
    existingWatt: "Existing wattage",
    product: "New product",
    addGroup: "+ Add group",
    duplicate: "Duplicate",
    remove: "Delete",
    group: "Group",
    existingType: "Existing technology",
    smart: "Smart",
    powerAid: "PowerAiD",
    hybrid: "Hybrid",
    annualSaving: "Annual net saving",
    capex: "CAPEX",
    payback: "Payback",
    energyReduction: "Energy reduction",
    baseline: "Baseline consumption",
    energySaving: "Energy saving",
    maintenance: "Maintenance saving",
    opex: "Recurring OPEX",
    importAudit: "Import Audit Sheet",
    importCatalog: "Import product catalogue",
    assumptions: "Assumptions",
    catalogue: "Product catalogue",
    customerNote: "Internal prices and assumptions are visible in Admin only.",
    emptyAudit: "Upload the VIMALUX template. Only rows 1–29 are read: column D quantity and column G watt.",
    imported: "Audit imported",
    save: "Automatic recalculation",
  },
};

function number(value) {
  if (value === "" || value === null || value === undefined) return 0;
  return Number(String(value).replace(",", ".")) || 0;
}

function money(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(number(value));
}

function decimal(value, digits = 1) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number(value));
}

export default function AppV31() {
  const [lang, setLang] = useState("it");
  const [adminMode, setAdminMode] = useState(false);
  const [mode, setMode] = useState("quick");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [project, setProject] = useState({ municipality: "", contact: "" });
  const [groups, setGroups] = useState([
    createManualGroup(1, {
      label: "Street lighting",
      quantity: 500,
      existingType: "SAP",
      existingWatt: 100,
      productId: "street60",
      smart: true,
      powerAid: true,
      hybrid: false,
    }),
  ]);
  const [auditName, setAuditName] = useState("");
  const [toast, setToast] = useState("");
  const auditInputRef = useRef(null);
  const catalogueInputRef = useRef(null);

  const t = TEXT[lang];
  const calculation = useMemo(
    () => calculateManualProject(groups, assumptions, products),
    [groups, assumptions, products]
  );

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  function updateGroup(id, field, value) {
    setGroups((current) =>
      current.map((group) =>
        group.id === id ? { ...group, [field]: value } : group
      )
    );
  }

  function addGroup(source) {
    const next = createManualGroup(groups.length + 1, source || {
      productId: products[0]?.id || "",
    });
    setGroups((current) => [...current, next]);
  }

  function duplicateGroup(group) {
    const { id, ...copy } = group;
    addGroup({ ...copy, label: `${group.label} copy` });
  }

  function removeGroup(id) {
    setGroups((current) =>
      current.length > 1 ? current.filter((group) => group.id !== id) : current
    );
  }

  function updateQuick(field, value) {
    updateGroup(groups[0].id, field, value);
  }

  async function importAudit(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const importedGroups = [];

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils
          .sheet_to_json(sheet, { header: 1, defval: "" })
          .slice(0, 29);

        rows.forEach((row, index) => {
          const quantity = number(row[3]);
          const existingWatt = number(row[6]);
          if (quantity > 0 && existingWatt > 0) {
            importedGroups.push(
              createManualGroup(importedGroups.length + 1, {
                label: String(row[1] || `${sheetName} ${index + 1}`),
                existingType: String(row[2] || "Unknown"),
                quantity,
                existingWatt,
                productId: products[0]?.id || "",
                smart: true,
                powerAid: false,
                hybrid: false,
              })
            );
          }
        });
      });

      if (!importedGroups.length) throw new Error("No valid rows");
      setGroups(importedGroups);
      setAuditName(file.name);
      setMode("manual");
      notify(`${t.imported}: ${importedGroups.length} ${t.group.toLowerCase()}`);
    } catch (error) {
      console.error(error);
      notify(lang === "it" ? "Errore import audit" : "Audit import failed");
    }

    event.target.value = "";
  }

  async function importCatalogue(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const imported = rows
        .map((row, index) => ({
          id: `catalogue-${Date.now()}-${index}`,
          name: String(row.name || row.Name || row.product || row.Product || `Product ${index + 1}`),
          watt: number(row.watt || row.Watt || row.power || row.Power),
          lumen: number(row.lumen || row.Lumen || row.lm || row.Lm),
          sellPrice: number(row.sellPrice || row.price || row.Price || row.prezzo),
          buyPrice: number(row.buyPrice || row.cost || row.Cost),
          install: number(row.install || row.Install || row.installation),
        }))
        .filter((product) => product.name && product.watt > 0);

      if (!imported.length) throw new Error("No valid products");
      setProducts(imported);
      setGroups((current) =>
        current.map((group) => ({ ...group, productId: imported[0].id }))
      );
      notify(`${imported.length} ${lang === "it" ? "prodotti importati" : "products imported"}`);
    } catch (error) {
      console.error(error);
      notify(lang === "it" ? "Errore catalogo" : "Catalogue import failed");
    }

    event.target.value = "";
  }

  return (
    <div style={styles.page}>
      {toast && <div style={styles.toast}>{toast}</div>}

      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{t.title}</h1>
          <div style={styles.subtitle}>{t.version}</div>
        </div>
        <div style={styles.headerActions}>
          <button style={!adminMode ? styles.primaryButton : styles.secondaryButton} onClick={() => setAdminMode(false)}>
            {t.customer}
          </button>
          <button style={adminMode ? styles.primaryButton : styles.secondaryButton} onClick={() => setAdminMode(true)}>
            {t.admin}
          </button>
          <button style={styles.secondaryButton} onClick={() => setLang(lang === "it" ? "en" : "it")}>
            {lang === "it" ? "EN" : "IT"}
          </button>
        </div>
      </header>

      <section style={styles.modeGrid}>
        {[
          ["quick", t.quick, "30 sec"],
          ["manual", t.manual, "5–10 min"],
          ["audit", t.audit, "Excel"],
        ].map(([id, label, sub]) => (
          <button
            key={id}
            style={mode === id ? styles.modeCardActive : styles.modeCard}
            onClick={() => {
              setMode(id);
              if (id === "audit") auditInputRef.current?.click();
            }}
          >
            <strong>{label}</strong>
            <span>{sub}</span>
          </button>
        ))}
      </section>

      <input ref={auditInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importAudit} />
      <input ref={catalogueInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={importCatalogue} />

      <section style={styles.kpiGrid}>
        <Kpi label={t.quantity} value={decimal(calculation.totals.quantity, 0)} />
        <Kpi label={t.capex} value={money(calculation.totals.totalCapex)} />
        <Kpi label={t.annualSaving} value={money(calculation.totals.annualNetSaving)} />
        <Kpi label={t.payback} value={calculation.totals.payback ? `${decimal(calculation.totals.payback)} ${lang === "it" ? "anni" : "yrs"}` : "–"} />
        <Kpi label={t.energyReduction} value={`${decimal(calculation.totals.energyReductionPct)}%`} />
        <Kpi label={t.baseline} value={`${decimal(calculation.totals.baselineKwh / 1000)} MWh`} />
      </section>

      <section style={styles.projectCard}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.h2}>{t.project}</h2>
            <div style={styles.muted}>{t.save}</div>
          </div>
          {auditName && <div style={styles.auditBadge}>{auditName}</div>}
        </div>
        <div style={styles.twoColumns}>
          <Field label={t.municipality} value={project.municipality} onChange={(value) => setProject((current) => ({ ...current, municipality: value }))} />
          <Field label={t.contact} value={project.contact} onChange={(value) => setProject((current) => ({ ...current, contact: value }))} />
        </div>
      </section>

      {mode === "quick" && (
        <section style={styles.projectCard}>
          <h2 style={styles.h2}>{t.quick}</h2>
          <div style={styles.quickGrid}>
            <Field label={t.quantity} value={groups[0].quantity} numeric onChange={(value) => updateQuick("quantity", number(value))} />
            <Field label={t.existingWatt} value={groups[0].existingWatt} numeric onChange={(value) => updateQuick("existingWatt", number(value))} />
            <SelectField label={t.product} value={groups[0].productId} options={products.map((product) => ({ value: product.id, label: `${product.name} – ${product.watt}W` }))} onChange={(value) => updateQuick("productId", value)} />
            <Toggle label={t.smart} checked={groups[0].smart} onChange={(checked) => updateQuick("smart", checked)} />
            <Toggle label={t.powerAid} checked={groups[0].powerAid} disabled={!groups[0].smart} onChange={(checked) => updateQuick("powerAid", checked)} />
            <Toggle label={t.hybrid} checked={groups[0].hybrid} onChange={(checked) => updateQuick("hybrid", checked)} />
          </div>
        </section>
      )}

      {mode === "audit" && (
        <section style={styles.auditDrop}>
          <strong>{t.audit}</strong>
          <p>{t.emptyAudit}</p>
          <button style={styles.greenButton} onClick={() => auditInputRef.current?.click()}>{t.importAudit}</button>
        </section>
      )}

      {mode === "manual" && (
        <section style={styles.projectCard}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.h2}>{t.manual}</h2>
            <button style={styles.primaryButton} onClick={() => addGroup()}>{t.addGroup}</button>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>{t.group}</th><th>{t.quantity}</th><th>{t.existingType}</th><th>{t.existingWatt}</th><th>{t.product}</th><th>{t.smart}</th><th>{t.powerAid}</th><th>{t.hybrid}</th><th />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td><input style={styles.tableInputWide} value={group.label} onChange={(event) => updateGroup(group.id, "label", event.target.value)} /></td>
                    <td><input style={styles.tableInput} value={group.quantity} onChange={(event) => updateGroup(group.id, "quantity", number(event.target.value))} /></td>
                    <td><input style={styles.tableInput} value={group.existingType} onChange={(event) => updateGroup(group.id, "existingType", event.target.value)} /></td>
                    <td><input style={styles.tableInput} value={group.existingWatt} onChange={(event) => updateGroup(group.id, "existingWatt", number(event.target.value))} /></td>
                    <td><select style={styles.tableSelect} value={group.productId} onChange={(event) => updateGroup(group.id, "productId", event.target.value)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.watt}W</option>)}</select></td>
                    <td><input type="checkbox" checked={group.smart} onChange={(event) => updateGroup(group.id, "smart", event.target.checked)} /></td>
                    <td><input type="checkbox" checked={group.powerAid} disabled={!group.smart} onChange={(event) => updateGroup(group.id, "powerAid", event.target.checked)} /></td>
                    <td><input type="checkbox" checked={group.hybrid} onChange={(event) => updateGroup(group.id, "hybrid", event.target.checked)} /></td>
                    <td><div style={styles.rowActions}><button onClick={() => duplicateGroup(group)}>{t.duplicate}</button><button onClick={() => removeGroup(group.id)}>{t.remove}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section style={styles.valueGrid}>
        <Value label={t.energySaving} value={money(calculation.totals.totalEnergySavingValue)} />
        <Value label={t.maintenance} value={money(calculation.totals.maintenanceSaving)} />
        <Value label={t.opex} value={`-${money(calculation.totals.recurringOpex)}`} negative />
        <Value label="Hybrid" value={`${decimal(calculation.totals.hybridSavingKwh / 1000)} MWh`} />
      </section>

      {!adminMode && <div style={styles.customerNote}>{t.customerNote}</div>}

      {adminMode && (
        <section style={styles.adminGrid}>
          <div style={styles.projectCard}>
            <div style={styles.sectionHeader}><h2 style={styles.h2}>{t.assumptions}</h2></div>
            <div style={styles.assumptionGrid}>
              {Object.entries(assumptions).map(([key, value]) => (
                <Field key={key} label={key} value={value} numeric onChange={(next) => setAssumptions((current) => ({ ...current, [key]: number(next) }))} />
              ))}
            </div>
          </div>
          <div style={styles.projectCard}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.h2}>{t.catalogue}</h2>
              <button style={styles.primaryButton} onClick={() => catalogueInputRef.current?.click()}>{t.importCatalog}</button>
            </div>
            {products.map((product, index) => (
              <div key={product.id} style={styles.productRow}>
                <input style={styles.productName} value={product.name} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                {[
                  ["W", "watt"], ["lm", "lumen"], ["Sell", "sellPrice"], ["Buy", "buyPrice"], ["Install", "install"],
                ].map(([label, field]) => (
                  <label key={field} style={styles.miniField}>{label}<input value={product[field]} onChange={(event) => setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: number(event.target.value) } : item))} /></label>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value }) {
  return <div style={styles.kpi}><span>{label}</span><strong>{value}</strong></div>;
}

function Value({ label, value, negative }) {
  return <div style={styles.valueCard}><span>{label}</span><strong style={{ color: negative ? "#dc2626" : "#0f172a" }}>{value}</strong></div>;
}

function Field({ label, value, onChange, numeric }) {
  return <label style={styles.field}><span>{label}</span><input inputMode={numeric ? "decimal" : "text"} value={String(value).replace(".", ",")} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }) {
  return <label style={styles.field}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange, disabled }) {
  return <label style={{ ...styles.toggle, opacity: disabled ? 0.5 : 1 }}><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

const styles = {
  page: { minHeight: "100vh", padding: 24, background: "#f4f7fb", color: "#0f172a", fontFamily: "Inter, Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", background: "white", border: "1px solid #dce4ef", borderRadius: 24, padding: 22, marginBottom: 18 },
  title: { margin: 0, fontSize: 31 }, subtitle: { marginTop: 5, color: "#64748b" }, headerActions: { display: "flex", gap: 9, flexWrap: "wrap" },
  primaryButton: { border: 0, borderRadius: 12, background: "#0f172a", color: "white", padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", borderRadius: 12, background: "white", color: "#0f172a", padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  greenButton: { border: 0, borderRadius: 12, background: "#16a34a", color: "white", padding: "12px 18px", fontWeight: 800, cursor: "pointer" },
  modeGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 18 },
  modeCard: { textAlign: "left", padding: 18, borderRadius: 18, border: "1px solid #dce4ef", background: "white", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5 },
  modeCardActive: { textAlign: "left", padding: 18, borderRadius: 18, border: "2px solid #2563eb", background: "#eff6ff", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: "white", border: "1px solid #dce4ef", borderRadius: 18, padding: 17, display: "flex", flexDirection: "column", gap: 8 },
  projectCard: { background: "white", border: "1px solid #dce4ef", borderRadius: 22, padding: 20, marginBottom: 18 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }, h2: { margin: 0 }, muted: { color: "#64748b", fontSize: 13 }, auditBadge: { background: "#ecfdf5", color: "#166534", borderRadius: 999, padding: "7px 11px", fontWeight: 700 },
  twoColumns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }, quickGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 },
  toggle: { border: "1px solid #d6deea", borderRadius: 14, padding: 13, display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 700 },
  auditDrop: { background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 22, padding: 24, marginBottom: 18 },
  tableWrap: { overflowX: "auto" }, table: { width: "100%", borderCollapse: "collapse", minWidth: 1120 },
  tableInput: { width: 80 }, tableInputWide: { width: 150 }, tableSelect: { minWidth: 185 }, rowActions: { display: "flex", gap: 5 },
  valueGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }, valueCard: { background: "white", border: "1px solid #dce4ef", borderRadius: 18, padding: 17, display: "flex", flexDirection: "column", gap: 7 },
  customerNote: { background: "#f8fafc", border: "1px solid #e2e8f0", padding: 14, borderRadius: 14, color: "#475569" },
  adminGrid: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }, assumptionGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  productRow: { display: "grid", gridTemplateColumns: "1.6fr repeat(5, 0.7fr)", gap: 7, alignItems: "end", marginBottom: 10 }, productName: { width: "100%" }, miniField: { fontSize: 10, display: "flex", flexDirection: "column", gap: 4 },
  toast: { position: "fixed", top: 18, right: 18, zIndex: 20, background: "#0f172a", color: "white", borderRadius: 12, padding: "12px 16px", fontWeight: 700 },
};
