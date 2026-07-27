import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  auditRowsToManualGroups,
  calculateManualProject,
  createManualGroup,
  recommendProduct,
} from "./v31ManualProjectEngine.js";

const PRODUCTS = [
  { id: "street20", name: "VIMALUX Street 20", watt: 20, lumen: 3200, sellPrice: 155, buyPrice: 85 },
  { id: "street30", name: "VIMALUX Street 30", watt: 30, lumen: 4800, sellPrice: 165, buyPrice: 92 },
  { id: "street40", name: "VIMALUX Street 40", watt: 40, lumen: 6400, sellPrice: 175, buyPrice: 100 },
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 9600, sellPrice: 190, buyPrice: 110 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 14400, sellPrice: 210, buyPrice: 150 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, lumen: 19200, sellPrice: 285, buyPrice: 205 },
  { id: "highway150", name: "VIMALUX Highway 150", watt: 150, lumen: 24000, sellPrice: 320, buyPrice: 230 },
];

const DEFAULTS = {
  cloSavingPct: 10,
  smartSolutionSavingPct: 0,
  maintenanceOldPerLamp: 25,
  powerAidAdditionalSavingPct: 40,
  energyPrice: 0.29,
  burningHours: 4200,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 0,
  hybridProductionKwhPerLampYear: 70,
  hybridAdditionalCapexPerLamp: 0,
  analysisYears: 20,
  savingIndexationPct: 0,
  discountRatePct: 6,
  performanceDegradationPct: 0,
  co2KgPerKwh: 0.233,
  sapBallastFactor: 1.2,
  mhBallastFactor: 1.15,
  mercuryBallastFactor: 1.15,
  fluorescentBallastFactor: 1.1,
  ledBallastFactor: 1,
  unknownBallastFactor: 1,
};

const integerFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const decimal1Formatter = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const money = (value) => `${integerFormatter.format(Math.round(Number(value) || 0))} €`;
const money2 = (value) => `${decimalFormatter.format(Number(value) || 0)} €`;
const number = (value, digits = 0) => digits === 2 ? decimalFormatter.format(Number(value) || 0) : digits === 1 ? decimal1Formatter.format(Number(value) || 0) : integerFormatter.format(Number(value) || 0);
const num = (value) => {
  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized) || 0;
};

function payment(principal, annualRate, years) {
  const months = Math.max(1, Math.round(years * 12));
  const rate = (annualRate / 100) / 12;
  return rate === 0 ? principal / months : principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1);
}

export default function AppV31Complete() {
  const [section, setSection] = useState("overview");
  const [viewMode, setViewMode] = useState("internal");
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [quoteLanguage, setQuoteLanguage] = useState("it");
  const [project, setProject] = useState({ municipality: "Comune di Larciano", quotationId: "Q-2026-001", contact: "", country: "Italy" });
  const [products] = useState(PRODUCTS);
  const [assumptions, setAssumptions] = useState(DEFAULTS);
  const [commercial, setCommercial] = useState({
    model: "Noleggio Operativo",
    years: 9,
    interestRate: 8,
    upfront: 0,
    installationSellPerLamp: 30,
    installationCostPerLamp: 25,
    freightSellPerLamp: 11,
    freightCostPerLamp: 11,
    maintenanceAfterPerLamp: 15,
    smartHardwareSellPerLamp: 62,
    smartHardwareCostPerLamp: 30,
    cmsSellPerLampYear: 6,
    cmsCostPerLampYear: 3.42,
    powerAidPerformanceSharePct: 10,
    powerAidCostPerLampYear: 0.24,
    commissionPct: 0,
    commissionBasis: "Luminaires",
    bonusPct: 8,
    financeSellOffPct: 8,
    overallPriceAdjustment: 0,
  });
  const [groups, setGroups] = useState([
    createManualGroup(1, { label: "Street lighting", quantity: 1182, existingType: "SAP", existingWatt: 100, productId: "street40", smart: true, powerAid: true, hybrid: false, recommendationTargetWatt: 40, recommendationConfidence: 85 }),
  ]);
  const auditRef = useRef(null);
  const calc = useMemo(() => calculateManualProject(groups, assumptions, products), [groups, assumptions, products]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const quote = useMemo(() => {
    const qty = calc.totals.quantity;
    const lumSell = groups.reduce((sum, g) => sum + num(g.quantity) * num(productMap.get(g.productId)?.sellPrice), 0);
    const lumCost = groups.reduce((sum, g) => sum + num(g.quantity) * num(productMap.get(g.productId)?.buyPrice), 0);
    const smartQty = groups.reduce((sum, g) => sum + (g.smart ? num(g.quantity) : 0), 0);
    const powerQty = groups.reduce((sum, g) => sum + (g.smart && g.powerAid ? num(g.quantity) : 0), 0);
    const smartSell = smartQty * commercial.smartHardwareSellPerLamp;
    const smartCost = smartQty * commercial.smartHardwareCostPerLamp;
    const installSell = qty * commercial.installationSellPerLamp;
    const installCost = qty * commercial.installationCostPerLamp;
    const freightSell = qty * commercial.freightSellPerLamp;
    const freightCost = qty * commercial.freightCostPerLamp;
    const cmsSell = smartQty * commercial.cmsSellPerLampYear * commercial.years;
    const cmsCost = smartQty * commercial.cmsCostPerLampYear * commercial.years;

    const powerAidAnnualGrossSaving = calc.totals.powerAidSavingKwh * assumptions.energyPrice;
    const powerAidAnnualFee = powerAidAnnualGrossSaving * commercial.powerAidPerformanceSharePct / 100;
    const powerSell = powerAidAnnualFee * commercial.years;
    const powerCost = powerQty * commercial.powerAidCostPerLampYear * commercial.years;
    const powerAidCustomerAnnualBenefit = Math.max(0, powerAidAnnualGrossSaving - powerAidAnnualFee);

    const baseCashPrice = lumSell + smartSell + installSell + freightSell + cmsSell + powerSell;
    const cashPrice = Math.max(0, baseCashPrice + commercial.overallPriceAdjustment);
    const principal = Math.max(0, cashPrice - commercial.upfront);
    const monthly = payment(principal, commercial.interestRate, commercial.years);
    const financedTotal = monthly * commercial.years * 12 + commercial.upfront;
    const interest = financedTotal - cashPrice;
    const annualPayment = monthly * 12;
    const maintenanceBefore = qty * assumptions.maintenanceOldPerLamp;
    const maintenanceAfter = qty * commercial.maintenanceAfterPerLamp;
    const maintenanceSaving = Math.max(0, maintenanceBefore - maintenanceAfter);
    const customerAnnualSaving = calc.totals.totalEnergySavingValue + maintenanceSaving - powerAidAnnualFee;
    const customerNet = customerAnnualSaving - annualPayment;
    const totalCost = lumCost + smartCost + installCost + freightCost + cmsCost + powerCost;
    const commissionBase = commercial.commissionBasis === "Total contract" ? cashPrice : lumSell;
    const commission = commissionBase * commercial.commissionPct / 100;
    const bonus = (cashPrice - freightSell) * commercial.bonusPct / 100;
    const financeCost = interest * commercial.financeSellOffPct / 100;
    const grossMargin = cashPrice - totalCost;
    const mol1 = grossMargin;
    const mol2 = mol1 - commission - bonus;
    const mol3 = mol2 - financeCost;
    const yearly = [];
    let cumulative = 0;
    for (let year = 1; year <= 20; year += 1) {
      const escalation = Math.pow(1 + assumptions.savingIndexationPct / 100, year - 1);
      const indexedEnergy = calc.totals.totalEnergySavingValue * escalation;
      const indexedPowerAidFee = powerAidAnnualFee * escalation;
      const totalSaving = indexedEnergy + maintenanceSaving - indexedPowerAidFee;
      const customerPayment = year <= commercial.years ? annualPayment : 0;
      const netCashflow = totalSaving - customerPayment;
      cumulative += netCashflow;
      yearly.push({ year, indexedEnergy, maintenanceSaving, powerAidFee: indexedPowerAidFee, totalSaving, customerPayment, netCashflow, cumulative, co2: calc.finance.annualCo2Tonnes, cumulativeCo2: calc.finance.annualCo2Tonnes * year });
    }
    return { qty, lumSell, lumCost, smartSell, smartCost, installSell, installCost, freightSell, freightCost, cmsSell, cmsCost, powerSell, powerCost, powerAidAnnualGrossSaving, powerAidAnnualFee, powerAidCustomerAnnualBenefit, cashPrice, monthly, annualPayment, financedTotal, interest, maintenanceSaving, customerAnnualSaving, customerNet, totalCost, commission, bonus, financeCost, grossMargin, mol1, mol2, mol3, yearly };
  }, [calc, groups, productMap, assumptions, commercial]);

  const updateGroup = (id, key, value) => setGroups((rows) => rows.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const updateCommercial = (key, value) => setCommercial((state) => ({ ...state, [key]: value }));
  const applyRecommendation = (id) => setGroups((rows) => rows.map((group) => {
    if (group.id !== id) return group;
    const recommendation = recommendProduct(group.existingType, group.existingWatt, products);
    return { ...group, productId: recommendation.productId || group.productId, recommendationTargetWatt: recommendation.targetWatt, recommendationConfidence: recommendation.confidence };
  }));

  async function importAudit(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const preferred = workbook.SheetNames.includes("Luminaire_Audit") ? "Luminaire_Audit" : workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[preferred], { defval: "" });
    const normalized = rows.map((row, index) => ({
      label: row.Group || row.Name || row.ID || row.Pole_ID || `Group ${index + 1}`,
      quantity: num(row.Quantity || row.Qty || 1),
      existingType: row.Existing_Type || row.Technology || row.Tecnologia || row.Lamp_Type || row.Type || "Unknown",
      existingWatt: num(row.Existing_Watt || row.Wattage || row.Watt || row.Power),
    })).filter((row) => row.existingWatt > 0);
    const imported = auditRowsToManualGroups(normalized, products);
    if (imported.length) setGroups(imported);
    setSection("audit");
    event.target.value = "";
  }

  function generateQuotation() {
    const it = quoteLanguage === "it";
    const rows = quote.yearly.map((row) => `<tr><td>${row.year}</td><td>${money(row.indexedEnergy)}</td><td>${money(row.powerAidFee)}</td><td>${money(row.maintenanceSaving)}</td><td>${money(row.customerPayment)}</td><td>${money(row.netCashflow)}</td><td>${money(row.cumulative)}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${project.quotationId}</title><style>body{font-family:Arial;color:#133439;margin:0;background:#f3f6f8}.page{max-width:1050px;margin:24px auto;background:white;padding:42px}.head{display:flex;justify-content:space-between;border-bottom:4px solid #c9f15a;padding-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{border:1px solid #dce6e7;border-radius:12px;padding:14px}.kpi b{display:block;font-size:20px;margin-top:7px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border-bottom:1px solid #e7eeee;text-align:right}th:first-child,td:first-child{text-align:left}.note{background:#eff8d8;padding:14px;border-radius:10px;margin:18px 0}@media print{body{background:white}.page{margin:0;max-width:none}}</style></head><body><div class="page"><div class="head"><div><b style="font-size:24px">VIMALUX Intelligence</b><div>Infrastructure Transformation Partner</div></div><div><b>${project.quotationId}</b><br>${project.municipality}</div></div><h1>${it ? "PROPOSTA COMMERCIALE" : "COMMERCIAL PROPOSAL"}</h1><div class="grid"><div class="kpi">${it ? "Punti luce" : "Luminaires"}<b>${number(quote.qty)}</b></div><div class="kpi">${it ? "Prezzo progetto" : "Project price"}<b>${money(quote.cashPrice)}</b></div><div class="kpi">${it ? "Pagamento mensile" : "Monthly payment"}<b>${money2(quote.monthly)}</b></div><div class="kpi">${it ? "Beneficio netto annuo" : "Annual net benefit"}<b>${money(quote.customerNet)}</b></div></div><h2>PowerAiD</h2><div class="note">${it ? "Il corrispettivo PowerAiD è calcolato come" : "The PowerAiD fee is calculated as"} ${number(commercial.powerAidPerformanceSharePct,1)}% ${it ? "del risparmio energetico aggiuntivo ottenuto dopo LED e CLO." : "of the additional energy saving achieved after LED and CLO."}<br><b>${it ? "Risparmio aggiuntivo lordo" : "Gross additional saving"}: ${money(quote.powerAidAnnualGrossSaving)}/${it ? "anno" : "year"}</b><br><b>${it ? "Corrispettivo VIMALUX" : "VIMALUX fee"}: ${money(quote.powerAidAnnualFee)}/${it ? "anno" : "year"}</b><br><b>${it ? "Beneficio PowerAiD trattenuto dal cliente" : "PowerAiD benefit retained by customer"}: ${money(quote.powerAidCustomerAnnualBenefit)}/${it ? "anno" : "year"}</b></div><h2>${it ? "Energia e ambiente" : "Energy and environment"}</h2><div class="grid"><div class="kpi">${it ? "Consumo iniziale" : "Baseline"}<b>${number(calc.totals.baselineKwh / 1000)} MWh</b></div><div class="kpi">${it ? "Consumo finale" : "Final consumption"}<b>${number(calc.totals.residualGridKwh / 1000)} MWh</b></div><div class="kpi">${it ? "Riduzione energia" : "Energy reduction"}<b>${number(calc.totals.energyReductionPct,1)}%</b></div><div class="kpi">CO₂<b>${number(calc.finance.annualCo2Tonnes,1)} t/${it ? "anno" : "year"}</b></div></div><h2>${it ? "Cash flow cliente dopo il pagamento" : "Customer cash flow after payment"}</h2><table><thead><tr><th>${it ? "Anno" : "Year"}</th><th>${it ? "Risparmio energia" : "Energy saving"}</th><th>PowerAiD</th><th>${it ? "Manutenzione" : "Maintenance"}</th><th>${it ? "Pagamento" : "Payment"}</th><th>${it ? "Cash flow netto" : "Net cash flow"}</th><th>${it ? "Cumulato" : "Cumulative"}</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return alert("Please allow pop-ups to generate the quotation.");
    win.document.open();
    win.document.write(html);
    win.document.close();
    setQuoteDialog(false);
  }

  const internalNav = [["overview", "Overview"], ["audit", "Audit & Lighting"], ["pricing", "Pricing"], ["finance", "Finance"], ["customer", "Customer Case"], ["internal", "Internal Approval"], ["settings", "Settings"]];
  const customerNav = [["overview", "Overview"], ["audit", "Audit & Lighting"], ["finance", "Finance"], ["customer", "Customer Case"]];
  const nav = viewMode === "internal" ? internalNav : customerNav;

  return <div style={s.shell}>
    <aside style={s.sidebar}>
      <div style={s.brand}><div style={s.logo}>V</div><div><b>VIMALUX</b><span>Intelligence</span></div></div>
      <div style={s.projectBadge}><span>ACTIVE QUOTATION</span><b>{project.municipality}</b><small>{project.quotationId}</small></div>
      <nav style={s.sideNav}>{nav.map(([id, label]) => <button key={id} style={section === id ? s.navActive : s.navButton} onClick={() => setSection(id)}>{label}</button>)}</nav>
      {viewMode === "internal" && <><button style={s.upload} onClick={() => auditRef.current?.click()}>＋ Import audit</button><input hidden ref={auditRef} type="file" accept=".xlsx,.xls,.csv" onChange={importAudit} /></>}
    </aside>

    <main style={s.main}>
      <header style={s.topbar}><div><span style={s.eyebrow}>QUOTATION WORKSPACE</span><h1>{project.municipality}</h1><p>Build and generate a customer-ready lighting offer.</p></div><div style={s.topActions}><button style={s.secondary} onClick={() => setViewMode(viewMode === "internal" ? "customer" : "internal")}>{viewMode === "internal" ? "Customer view" : "Internal view"}</button><button style={s.primary} onClick={() => setQuoteDialog(true)}>Generate quotation</button></div></header>
      <section style={s.kpis}><Kpi label="Luminaires" value={number(quote.qty)} /><Kpi label="Cash price" value={money(quote.cashPrice)} /><Kpi label="Monthly payment" value={money2(quote.monthly)} /><Kpi label="Customer net saving" value={money(quote.customerNet)} /><Kpi label="Energy reduction" value={`${number(calc.totals.energyReductionPct,1)}%`} /><Kpi label="CO₂ reduction" value={`${number(calc.finance.annualCo2Tonnes,1)} t`} /></section>

      {section === "overview" && <div style={s.grid2}><Card title="Project setup"><div style={s.formGrid}><Field label="Municipality" value={project.municipality} onChange={(value) => setProject((x) => ({ ...x, municipality: value }))} /><Field label="Quotation ID" value={project.quotationId} onChange={(value) => setProject((x) => ({ ...x, quotationId: value }))} /></div></Card><Card title="Commercial summary"><Row label="Model" value={commercial.model} /><Row label="Contract period" value={`${commercial.years} years`} /><Row label="Financed total" value={money(quote.financedTotal)} /><Row label="Annual customer saving" value={money(quote.customerAnnualSaving)} /></Card></div>}

      {section === "audit" && <Card title="Audit & lighting"><div style={s.tableWrap}><table style={s.table}><thead><tr><th>Group</th><th>Qty</th><th>Technology</th><th>Existing W</th><th>Selected luminaire</th><th>Smart</th><th>PowerAiD</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td><input value={group.label} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "label", e.target.value)} /></td><td><input value={group.quantity} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "quantity", num(e.target.value))} /></td><td><select value={group.existingType} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "existingType", e.target.value)}><option>SAP</option><option>LED</option><option>MH</option><option>Mercury</option><option>Unknown</option></select></td><td><input value={group.existingWatt} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "existingWatt", num(e.target.value))} /></td><td><select value={group.productId} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "productId", e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.watt}W</option>)}</select><button style={s.smallButton} disabled={viewMode !== "internal"} onClick={() => applyRecommendation(group.id)}>Apply AI recommendation</button></td><td><input type="checkbox" checked={group.smart} disabled={viewMode !== "internal"} onChange={(e) => updateGroup(group.id, "smart", e.target.checked)} /></td><td><input type="checkbox" checked={group.powerAid} disabled={viewMode !== "internal" || !group.smart} onChange={(e) => updateGroup(group.id, "powerAid", e.target.checked)} /></td></tr>)}</tbody></table></div></Card>}

      {section === "pricing" && viewMode === "internal" && <><Card title="Project pricing"><div style={s.formGrid3}><Field numeric label="Installation cost / lamp" value={commercial.installationCostPerLamp} onChange={(v) => updateCommercial("installationCostPerLamp", num(v))} /><Field numeric label="Installation sales / lamp" value={commercial.installationSellPerLamp} onChange={(v) => updateCommercial("installationSellPerLamp", num(v))} /><Field numeric label="Freight & duty cost / lamp" value={commercial.freightCostPerLamp} onChange={(v) => updateCommercial("freightCostPerLamp", num(v))} /><Field numeric label="Freight & duty sales / lamp" value={commercial.freightSellPerLamp} onChange={(v) => updateCommercial("freightSellPerLamp", num(v))} /><Field numeric label="Smart hardware cost / lamp" value={commercial.smartHardwareCostPerLamp} onChange={(v) => updateCommercial("smartHardwareCostPerLamp", num(v))} /><Field numeric label="Smart hardware sales / lamp" value={commercial.smartHardwareSellPerLamp} onChange={(v) => updateCommercial("smartHardwareSellPerLamp", num(v))} /><Field numeric label="CMS cost / lamp / year" value={commercial.cmsCostPerLampYear} onChange={(v) => updateCommercial("cmsCostPerLampYear", num(v))} /><Field numeric label="CMS sales / lamp / year" value={commercial.cmsSellPerLampYear} onChange={(v) => updateCommercial("cmsSellPerLampYear", num(v))} /><Field numeric label="PowerAiD share of extra saving %" value={commercial.powerAidPerformanceSharePct} onChange={(v) => updateCommercial("powerAidPerformanceSharePct", num(v))} /><Field numeric label="PowerAiD internal cost / lamp / year" value={commercial.powerAidCostPerLampYear} onChange={(v) => updateCommercial("powerAidCostPerLampYear", num(v))} /><Field numeric label="Agent commission %" value={commercial.commissionPct} onChange={(v) => updateCommercial("commissionPct", num(v))} /><Field numeric label="Bonus %" value={commercial.bonusPct} onChange={(v) => updateCommercial("bonusPct", num(v))} /></div></Card><Card title="PowerAiD performance pricing"><Row label="Calculation basis" value="Additional saving after LED + CLO" /><Row label="PowerAiD extra saving" value={`${number(calc.totals.powerAidSavingKwh)} kWh/year`} /><Row label="Gross extra saving" value={money(quote.powerAidAnnualGrossSaving)} /><Row label={`VIMALUX share (${number(commercial.powerAidPerformanceSharePct,1)}%)`} value={money(quote.powerAidAnnualFee)} highlight /><Row label="Customer retained benefit" value={money(quote.powerAidCustomerAnnualBenefit)} /></Card><Card title="Cost & pricing engine"><PriceTable rows={pricingRows(quote)} /></Card></>}

      {section === "finance" && <div style={s.grid2}><Card title="Financing"><div style={s.formGrid}><Select label="Model" value={commercial.model} options={["Noleggio Operativo", "Cash purchase", "Lighting as a Service", "ESCO", "PPP"]} onChange={(v) => updateCommercial("model", v)} /><Field numeric label="Period (years)" value={commercial.years} onChange={(v) => updateCommercial("years", num(v))} /><Field numeric label="Customer interest %" value={commercial.interestRate} onChange={(v) => updateCommercial("interestRate", num(v))} /><Field numeric label="Upfront payment" value={commercial.upfront} onChange={(v) => updateCommercial("upfront", num(v))} /></div></Card><Card title="Payment result"><div style={s.heroNumber}>{money2(quote.monthly)}<span>per month</span></div><Row label="Annual payment" value={money(quote.annualPayment)} /><Row label="Financed total" value={money(quote.financedTotal)} /><Row label="Total interest" value={money(quote.interest)} /></Card></div>}

      {section === "customer" && <><div style={s.grid2}><Card title="Customer business case"><Row label="Energy saving / year" value={money(calc.totals.totalEnergySavingValue)} /><Row label="PowerAiD fee / year" value={`− ${money(quote.powerAidAnnualFee)}`} /><Row label="Maintenance saving / year" value={money(quote.maintenanceSaving)} /><Row label="Total customer saving / year" value={money(quote.customerAnnualSaving)} /><Row label="Annual payment" value={`− ${money(quote.annualPayment)}`} /><Row label="Net benefit / year" value={money(quote.customerNet)} highlight /></Card><Card title="Energy & CO₂"><Row label="Baseline consumption" value={`${number(calc.totals.baselineKwh / 1000)} MWh`} /><Row label="After LED + CLO" value={`${number((calc.totals.baselineKwh - calc.totals.ledEnergySavingKwh - calc.totals.cloSavingKwh) / 1000)} MWh`} /><Row label="PowerAiD additional saving" value={`${number(calc.totals.powerAidSavingKwh / 1000)} MWh`} /><Row label="Final consumption" value={`${number(calc.totals.residualGridKwh / 1000)} MWh`} /><Row label="CO₂ reduction / year" value={`${number(calc.finance.annualCo2Tonnes,1)} t`} /></Card></div><Card title="Customer cash flow after payment"><CashflowTable rows={quote.yearly} /></Card></>}

      {section === "internal" && viewMode === "internal" && <><section style={s.approvalHero}><div><span>APPROVAL STATUS</span><b>{quote.mol3 > 0 ? "APPROVABLE" : "REVIEW REQUIRED"}</b></div><ApprovalMetric label="Revenue" value={money(quote.cashPrice)} /><ApprovalMetric label="Direct cost" value={money(quote.totalCost)} /><ApprovalMetric label="Gross margin" value={money(quote.grossMargin)} /><ApprovalMetric label="MOL 3" value={money(quote.mol3)} /></section><div style={s.grid2}><Card title="Margin bridge"><Row label="Gross margin / MOL 1" value={money(quote.mol1)} /><Row label="Agent commission" value={`− ${money(quote.commission)}`} /><Row label="Bonus" value={`− ${money(quote.bonus)}`} /><Row label="Finance cost" value={`− ${money(quote.financeCost)}`} /><Row label="MOL 3" value={money(quote.mol3)} highlight /></Card><Card title="PowerAiD economics"><Row label="Annual gross value created" value={money(quote.powerAidAnnualGrossSaving)} /><Row label="Annual VIMALUX revenue" value={money(quote.powerAidAnnualFee)} /><Row label="Contract revenue" value={money(quote.powerSell)} /><Row label="Contract internal cost" value={money(quote.powerCost)} /></Card></div></>}

      {section === "settings" && viewMode === "internal" && <div style={s.grid2}><Card title="Commercial assumptions"><div style={s.formGrid}><Field numeric label="Maintenance after / lamp / year" value={commercial.maintenanceAfterPerLamp} onChange={(v) => updateCommercial("maintenanceAfterPerLamp", num(v))} /><Field numeric label="Finance sell-off cost %" value={commercial.financeSellOffPct} onChange={(v) => updateCommercial("financeSellOffPct", num(v))} /><Field numeric label="Electricity price increase % / year" value={assumptions.savingIndexationPct} onChange={(v) => setAssumptions((x) => ({ ...x, savingIndexationPct: num(v) }))} /><Field numeric label="Energy price (€/kWh)" value={assumptions.energyPrice} onChange={(v) => setAssumptions((x) => ({ ...x, energyPrice: num(v) }))} /></div></Card><Card title="Technical assumptions"><div style={s.formGrid}><Field numeric label="Burning hours / year" value={assumptions.burningHours} onChange={(v) => setAssumptions((x) => ({ ...x, burningHours: num(v) }))} /><Field numeric label="CLO saving %" value={assumptions.cloSavingPct} onChange={(v) => setAssumptions((x) => ({ ...x, cloSavingPct: num(v) }))} /><Field numeric label="PowerAiD additional saving % after CLO" value={assumptions.powerAidAdditionalSavingPct} onChange={(v) => setAssumptions((x) => ({ ...x, powerAidAdditionalSavingPct: num(v) }))} /><Field numeric label="CO₂ kg / kWh" value={assumptions.co2KgPerKwh} onChange={(v) => setAssumptions((x) => ({ ...x, co2KgPerKwh: num(v) }))} /></div></Card></div>}
    </main>

    {quoteDialog && <div style={s.modalBackdrop}><div style={s.modal}><h2>Generate quotation</h2><p>Open a printable customer quotation and save it as PDF.</p><Select label="Language" value={quoteLanguage} options={["it", "en"]} onChange={setQuoteLanguage} /><div style={s.modalActions}><button style={s.secondary} onClick={() => setQuoteDialog(false)}>Cancel</button><button style={s.primary} onClick={generateQuotation}>Generate quotation</button></div></div></div>}
  </div>;
}

const pricingRows = (quote) => [
  ["LED luminaires", quote.lumCost, quote.lumSell],
  ["CityManager hardware", quote.smartCost, quote.smartSell],
  ["CMS, connectivity & support", quote.cmsCost, quote.cmsSell],
  ["PowerAiD performance service", quote.powerCost, quote.powerSell],
  ["Installation", quote.installCost, quote.installSell],
  ["Freight & duty", quote.freightCost, quote.freightSell],
];
function Kpi({ label, value }) { return <div style={s.kpi}><span>{label}</span><b>{value}</b></div>; }
function Card({ title, children }) { return <section style={s.card}><h2>{title}</h2><div style={{ marginTop: 16 }}>{children}</div></section>; }
function Field({ label, value, onChange, numeric }) { return <label style={s.field}><span>{label}</span><input inputMode={numeric ? "decimal" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label style={s.field}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Row({ label, value, highlight }) { return <div style={highlight ? { ...s.row, ...s.rowHighlight } : s.row}><span>{label}</span><b>{value}</b></div>; }
function ApprovalMetric({ label, value }) { return <div style={s.approvalMetric}><span>{label}</span><b>{value}</b></div>; }
function PriceTable({ rows }) { return <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Component</th><th>Cost</th><th>Sales price</th><th>Margin</th><th>Margin %</th></tr></thead><tbody>{rows.map(([name, cost, sell]) => { const margin = sell - cost; return <tr key={name}><td><b>{name}</b></td><td>{money(cost)}</td><td>{money(sell)}</td><td>{money(margin)}</td><td>{sell ? `${number(margin / sell * 100,1)}%` : "–"}</td></tr>; })}</tbody></table></div>; }
function CashflowTable({ rows }) { return <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Year</th><th>Energy saving</th><th>PowerAiD fee</th><th>Maintenance</th><th>Customer payment</th><th>Net cash flow</th><th>Accumulated</th></tr></thead><tbody>{rows.map((row) => <tr key={row.year}><td>{row.year}</td><td>{money(row.indexedEnergy)}</td><td>− {money(row.powerAidFee)}</td><td>{money(row.maintenanceSaving)}</td><td>− {money(row.customerPayment)}</td><td>{money(row.netCashflow)}</td><td>{money(row.cumulative)}</td></tr>)}</tbody></table></div>; }

const s = {
  shell: { minHeight: "100vh", display: "flex", background: "#f3f6f8", color: "#102a2e", fontFamily: "Inter,Arial,sans-serif" },
  sidebar: { position: "fixed", inset: "0 auto 0 0", width: 238, background: "#0d2b2f", color: "white", padding: 20, boxSizing: "border-box", minHeight: "100vh" },
  brand: { display: "flex", gap: 11, alignItems: "center", paddingBottom: 22 },
  logo: { width: 38, height: 38, borderRadius: 10, background: "#c9f15a", color: "#0d2b2f", display: "grid", placeItems: "center", fontWeight: 900 },
  projectBadge: { display: "grid", gap: 5, padding: 14, border: "1px solid #27494d", background: "#15373b", borderRadius: 12, marginBottom: 12 },
  sideNav: { display: "grid", gap: 5 },
  navButton: { border: 0, background: "transparent", color: "#b8c8ca", padding: "11px 12px", borderRadius: 9, textAlign: "left", cursor: "pointer" },
  navActive: { border: 0, background: "#c9f15a", color: "#102a2e", padding: "11px 12px", borderRadius: 9, textAlign: "left", fontWeight: 800, cursor: "pointer" },
  upload: { marginTop: 18, padding: 12, width: "100%", borderRadius: 9, border: "1px dashed #5d777a", background: "transparent", color: "white" },
  main: { marginLeft: 238, width: "calc(100% - 238px)", padding: "30px 34px 60px", boxSizing: "border-box" },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: "#668084" },
  topActions: { display: "flex", gap: 10 },
  primary: { border: 0, background: "#0d2b2f", color: "white", padding: "11px 15px", borderRadius: 9, fontWeight: 700, cursor: "pointer" },
  secondary: { border: "1px solid #cad6d8", background: "white", padding: "10px 14px", borderRadius: 9, fontWeight: 700, cursor: "pointer" },
  smallButton: { marginTop: 5, border: 0, padding: "6px 8px", borderRadius: 7, cursor: "pointer" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(6,minmax(130px,1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: "white", border: "1px solid #dfe7e8", borderRadius: 13, padding: 16, display: "grid", gap: 7 },
  card: { background: "white", border: "1px solid #dfe7e8", borderRadius: 15, padding: 20, marginBottom: 16 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(150px,1fr))", gap: 13 },
  formGrid3: { display: "grid", gridTemplateColumns: "repeat(3,minmax(150px,1fr))", gap: 13 },
  field: { display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#52696c" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  row: { display: "flex", justifyContent: "space-between", gap: 15, padding: "11px 0", borderBottom: "1px solid #edf1f2" },
  rowHighlight: { background: "#eff8d8", padding: "13px 12px", borderRadius: 9, border: 0, marginTop: 7 },
  heroNumber: { fontSize: 34, fontWeight: 850, color: "#0d2b2f", display: "grid", gap: 5, marginBottom: 12 },
  approvalHero: { display: "grid", gridTemplateColumns: "1.2fr repeat(4,1fr)", gap: 12, marginBottom: 16 },
  approvalMetric: { padding: 17, border: "1px solid #dfe7e8", background: "white", borderRadius: 13, display: "grid", gap: 7 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(13,43,47,.58)", display: "grid", placeItems: "center", zIndex: 30, padding: 20 },
  modal: { width: "min(650px,100%)", background: "white", borderRadius: 16, padding: 22 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
};

const style = document.createElement("style");
style.textContent = `*{box-sizing:border-box}body{margin:0}h1{margin:3px 0 5px;font-size:29px}h2{margin:0;font-size:17px}p{margin:0;color:#6e8285;font-size:13px}.projectBadge span,.projectBadge small{font-size:10px;color:#91a9ab}.brand span{display:block;font-size:11px;color:#91a9ab}.kpi span{font-size:11px;color:#6c8184;text-transform:uppercase}.kpi b{font-size:20px}input,select{width:100%;border:1px solid #cad6d8;border-radius:8px;padding:9px;background:white;color:#17363a}input[type=checkbox]{width:16px}th{text-align:left;font-size:10px;text-transform:uppercase;color:#708487;padding:10px;border-bottom:1px solid #dce5e6}td{padding:10px;border-bottom:1px solid #edf1f2;font-size:12px}@media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)!important}.formGrid3{grid-template-columns:repeat(2,1fr)!important}.approvalHero{grid-template-columns:repeat(2,1fr)!important}}`;
if (typeof document !== "undefined" && !document.getElementById("vimalux-intelligence-css")) { style.id = "vimalux-intelligence-css"; document.head.appendChild(style); }
