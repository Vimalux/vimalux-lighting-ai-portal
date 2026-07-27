import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { auditRowsToManualGroups, calculateManualProject, createManualGroup, recommendProduct } from "./v31ManualProjectEngine.js";

const PRODUCTS = [
  { id:"street20", name:"VIMALUX Street 20", watt:20, lumen:3200, sellPrice:155, buyPrice:85 },
  { id:"street30", name:"VIMALUX Street 30", watt:30, lumen:4800, sellPrice:165, buyPrice:92 },
  { id:"street40", name:"VIMALUX Street 40", watt:40, lumen:6400, sellPrice:175, buyPrice:100 },
  { id:"street60", name:"VIMALUX Street 60", watt:60, lumen:9600, sellPrice:190, buyPrice:110 },
  { id:"road90", name:"VIMALUX Road 90", watt:90, lumen:14400, sellPrice:210, buyPrice:150 },
  { id:"highway120", name:"VIMALUX Highway 120", watt:120, lumen:19200, sellPrice:285, buyPrice:205 },
  { id:"highway150", name:"VIMALUX Highway 150", watt:150, lumen:24000, sellPrice:320, buyPrice:230 },
];

const DEFAULTS = {
  cloSavingPct:10, smartSolutionSavingPct:20, maintenanceOldPerLamp:25,
  powerAidAdditionalSavingPct:40, energyPrice:0.29, burningHours:4200,
  smartNodeCost:62, cmsFeePerLampYear:6, powerAidFeePerLampYear:3,
  hybridProductionKwhPerLampYear:70, hybridAdditionalCapexPerLamp:0,
  analysisYears:20, savingIndexationPct:0, discountRatePct:6,
  performanceDegradationPct:0, co2KgPerKwh:0.233, sapBallastFactor:1.2,
  mhBallastFactor:1.15, mercuryBallastFactor:1.15,
  fluorescentBallastFactor:1.1, ledBallastFactor:1, unknownBallastFactor:1,
};

const integerFormatter = new Intl.NumberFormat("it-IT", { maximumFractionDigits:0 });
const decimalFormatter = new Intl.NumberFormat("it-IT", { minimumFractionDigits:2, maximumFractionDigits:2 });
const decimal1Formatter = new Intl.NumberFormat("it-IT", { minimumFractionDigits:1, maximumFractionDigits:1 });
const money = value => `${integerFormatter.format(Math.round(Number(value)||0))} €`;
const money2 = value => `${decimalFormatter.format(Number(value)||0)} €`;
const number = (value,digits=0) => digits===2 ? decimalFormatter.format(Number(value)||0) : digits===1 ? decimal1Formatter.format(Number(value)||0) : integerFormatter.format(Number(value)||0);
const num = value => Number(String(value??"").replace(/\./g,"").replace(",","."))||0;

function payment(principal, annualRate, years){
  const months=Math.max(1,Math.round(years*12));
  const rate=(annualRate/100)/12;
  return rate===0 ? principal/months : principal*rate*Math.pow(1+rate,months)/(Math.pow(1+rate,months)-1);
}

export default function AppV31Complete(){
  const [section,setSection]=useState("overview");
  const [viewMode,setViewMode]=useState("internal");
  const [quoteDialog,setQuoteDialog]=useState(false);
  const [quoteLanguage,setQuoteLanguage]=useState("it");
  const [selectedPeriods,setSelectedPeriods]=useState([5,9,10,15,20]);
  const [project,setProject]=useState({municipality:"Comune di Larciano",quotationId:"Q-2026-001",contact:"",country:"Italy"});
  const [products,setProducts]=useState(PRODUCTS);
  const [assumptions,setAssumptions]=useState(DEFAULTS);
  const [commercial,setCommercial]=useState({
    model:"Noleggio Operativo", years:9, interestRate:8, upfront:0,
    installationSellPerLamp:30, installationCostPerLamp:25,
    freightSellPerLamp:11, freightCostPerLamp:11,
    maintenanceAfterPerLamp:15,
    smartHardwareSellPerLamp:62, smartHardwareCostPerLamp:30,
    cmsSellPerLampYear:6, cmsCostPerLampYear:3.42,
    powerAidSellPerLampYear:3, powerAidCostPerLampYear:0.24,
    commissionPct:0, commissionBasis:"Luminaires", bonusPct:8,
    financeSellOffPct:8, overallPriceAdjustment:0,
  });
  const [groups,setGroups]=useState([createManualGroup(1,{label:"Street lighting",quantity:1182,existingType:"SAP",existingWatt:100,productId:"street40",smart:true,powerAid:true,hybrid:false,recommendationTargetWatt:40,recommendationConfidence:85})]);
  const auditRef=useRef(null);
  const calc=useMemo(()=>calculateManualProject(groups,assumptions,products),[groups,assumptions,products]);
  const productMap=useMemo(()=>new Map(products.map(product=>[product.id,product])),[products]);

  const quote=useMemo(()=>{
    const qty=calc.totals.quantity;
    const lumSell=groups.reduce((sum,g)=>sum+num(g.quantity)*num(productMap.get(g.productId)?.sellPrice),0);
    const lumCost=groups.reduce((sum,g)=>sum+num(g.quantity)*num(productMap.get(g.productId)?.buyPrice),0);
    const smartQty=groups.reduce((sum,g)=>sum+(g.smart?num(g.quantity):0),0);
    const powerQty=groups.reduce((sum,g)=>sum+(g.smart&&g.powerAid?num(g.quantity):0),0);
    const smartSell=smartQty*commercial.smartHardwareSellPerLamp;
    const smartCost=smartQty*commercial.smartHardwareCostPerLamp;
    const installSell=qty*commercial.installationSellPerLamp;
    const installCost=qty*commercial.installationCostPerLamp;
    const freightSell=qty*commercial.freightSellPerLamp;
    const freightCost=qty*commercial.freightCostPerLamp;
    const cmsSell=smartQty*commercial.cmsSellPerLampYear*commercial.years;
    const cmsCost=smartQty*commercial.cmsCostPerLampYear*commercial.years;
    const powerSell=powerQty*commercial.powerAidSellPerLampYear*commercial.years;
    const powerCost=powerQty*commercial.powerAidCostPerLampYear*commercial.years;
    const baseCashPrice=lumSell+smartSell+installSell+freightSell+cmsSell+powerSell;
    const cashPrice=Math.max(0,baseCashPrice+commercial.overallPriceAdjustment);
    const principal=Math.max(0,cashPrice-commercial.upfront);
    const monthly=payment(principal,commercial.interestRate,commercial.years);
    const financedTotal=monthly*commercial.years*12+commercial.upfront;
    const interest=financedTotal-cashPrice;
    const annualPayment=monthly*12;
    const maintenanceBefore=qty*assumptions.maintenanceOldPerLamp;
    const maintenanceAfter=qty*commercial.maintenanceAfterPerLamp;
    const maintenanceSaving=Math.max(0,maintenanceBefore-maintenanceAfter);
    const customerAnnualSaving=calc.totals.totalEnergySavingValue+maintenanceSaving;
    const customerNet=customerAnnualSaving-annualPayment;
    const totalCost=lumCost+smartCost+installCost+freightCost+cmsCost+powerCost;
    const commissionBase=commercial.commissionBasis==="Total contract"?cashPrice:lumSell;
    const commission=commissionBase*commercial.commissionPct/100;
    const bonus=(cashPrice-freightSell)*commercial.bonusPct/100;
    const financeCost=interest*commercial.financeSellOffPct/100;
    const grossMargin=cashPrice-totalCost;
    const mol1=grossMargin;
    const mol2=mol1-commission-bonus;
    const mol3=mol2-financeCost;
    const yearly=[];
    let cumulative=0;
    for(let year=1;year<=20;year+=1){
      const indexedEnergy=calc.totals.totalEnergySavingValue*Math.pow(1+assumptions.savingIndexationPct/100,year-1);
      const totalSaving=indexedEnergy+maintenanceSaving;
      const customerPayment=year<=commercial.years?annualPayment:0;
      const netCashflow=totalSaving-customerPayment;
      cumulative+=netCashflow;
      yearly.push({year,indexedEnergy,maintenanceSaving,totalSaving,customerPayment,netCashflow,cumulative,co2:calc.finance.annualCo2Tonnes,cumulativeCo2:calc.finance.annualCo2Tonnes*year});
    }
    return {qty,lumSell,lumCost,smartSell,smartCost,installSell,installCost,freightSell,freightCost,cmsSell,cmsCost,powerSell,powerCost,cashPrice,monthly,annualPayment,financedTotal,interest,maintenanceSaving,customerAnnualSaving,customerNet,totalCost,commission,bonus,financeCost,grossMargin,mol1,mol2,mol3,yearly};
  },[calc,groups,productMap,assumptions,commercial]);

  const updateGroup=(id,key,value)=>setGroups(rows=>rows.map(row=>row.id===id?{...row,[key]:value}:row));
  const updateCommercial=(key,value)=>setCommercial(state=>({...state,[key]:value}));
  const applyRecommendation=id=>setGroups(rows=>rows.map(group=>{if(group.id!==id)return group;const recommendation=recommendProduct(group.existingType,group.existingWatt,products);return {...group,productId:recommendation.productId||group.productId,recommendationTargetWatt:recommendation.targetWatt,recommendationConfidence:recommendation.confidence};}));

  function toggleView(){
    const next=viewMode==="internal"?"customer":"internal";
    setViewMode(next);
    if(next==="customer" && ["pricing","internal","settings"].includes(section)) setSection("customer");
  }

  async function importAudit(event){
    const file=event.target.files?.[0]; if(!file)return;
    const workbook=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const preferred=workbook.SheetNames.includes("Luminaire_Audit")?"Luminaire_Audit":workbook.SheetNames[0];
    const rows=XLSX.utils.sheet_to_json(workbook.Sheets[preferred],{defval:""});
    const normalized=rows.map((row,index)=>({label:row.Group||row.Name||row.ID||row.Pole_ID||`Group ${index+1}`,quantity:num(row.Quantity||row.Qty||1),existingType:row.Existing_Type||row.Technology||row.Tecnologia||row.Lamp_Type||row.Type||"Unknown",existingWatt:num(row.Existing_Watt||row.Wattage||row.Watt||row.Power)})).filter(row=>row.existingWatt>0);
    const imported=auditRowsToManualGroups(normalized,products);
    if(imported.length)setGroups(imported);
    setSection("audit"); event.target.value="";
  }

  function generateQuotation(){
    const isItalian=quoteLanguage==="it";
    const rows=quote.yearly.filter(row=>row.year<=commercial.years||selectedPeriods.includes(row.year)).map(row=>`<tr><td>${row.year}</td><td>${money(row.indexedEnergy)}</td><td>${money(row.maintenanceSaving)}</td><td>${money(row.customerPayment)}</td><td class="${row.netCashflow>=0?"positive":"negative"}">${money(row.netCashflow)}</td><td>${money(row.cumulative)}</td></tr>`).join("");
    const periodCards=selectedPeriods.map(period=>{const row=quote.yearly[period-1];return `<div class="period"><b>${period} ${isItalian?"anni":"years"}</b><span>${money(row?.cumulative||0)}</span><small>${number(row?.cumulativeCo2||0,1)} t CO₂</small></div>`}).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${project.quotationId}</title><style>body{margin:0;background:#f2f6f6;color:#133439;font-family:Arial,sans-serif}.page{max-width:1080px;margin:24px auto;background:#fff;padding:44px}.head{display:flex;justify-content:space-between;border-bottom:4px solid #c9f15a;padding-bottom:18px}.brand{font-size:24px;font-weight:800}.muted{color:#6e8285}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi,.period{border:1px solid #dce6e7;border-radius:12px;padding:15px;display:grid;gap:7px}.kpi b,.period span{font-size:20px}.periods{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border-bottom:1px solid #e7eeee;text-align:right}th:first-child,td:first-child{text-align:left}.positive{color:#0f8a5f;font-weight:700}.negative{color:#b42318;font-weight:700}h1{margin:30px 0 5px}h2{margin-top:32px}.foot{margin-top:30px;padding-top:15px;border-top:1px solid #dce6e7;color:#6e8285;font-size:11px}@media print{body{background:#fff}.page{margin:0;max-width:none;padding:20px}}</style></head><body><div class="page"><div class="head"><div><div class="brand">VIMALUX</div><div class="muted">Infrastructure Transformation Partner</div></div><div><b>${project.quotationId}</b><br>${project.municipality}</div></div><h1>${isItalian?"PROPOSTA DI TRASFORMAZIONE INFRASTRUTTURALE":"INFRASTRUCTURE TRANSFORMATION PROPOSAL"}</h1><p class="muted">${project.municipality}</p><h2>${isItalian?"Sintesi economica":"Financial summary"}</h2><div class="grid"><div class="kpi"><span>${isItalian?"Punti luce":"Luminaires"}</span><b>${number(quote.qty)}</b></div><div class="kpi"><span>${isItalian?"Investimento":"Cash price"}</span><b>${money(quote.cashPrice)}</b></div><div class="kpi"><span>${isItalian?"Pagamento mensile":"Monthly payment"}</span><b>${money2(quote.monthly)}</b></div><div class="kpi"><span>${isItalian?"Beneficio netto annuo":"Annual net benefit"}</span><b>${money(quote.customerNet)}</b></div></div><h2>${isItalian?"Benefici energetici e ambientali":"Energy and environmental benefits"}</h2><div class="grid"><div class="kpi"><span>${isItalian?"Consumo prima":"Baseline consumption"}</span><b>${number(calc.totals.baselineKwh/1000)} MWh</b></div><div class="kpi"><span>${isItalian?"Consumo dopo":"New consumption"}</span><b>${number(calc.totals.residualGridKwh/1000)} MWh</b></div><div class="kpi"><span>${isItalian?"Riduzione energia":"Energy reduction"}</span><b>${number(calc.totals.energyReductionPct,1)}%</b></div><div class="kpi"><span>${isItalian?"CO₂ evitata annua":"Annual CO₂ reduction"}</span><b>${number(calc.finance.annualCo2Tonnes,1)} t</b></div></div><h2>${isItalian?"Cash flow del Comune dopo il pagamento":"Municipality cash flow after customer payment"}</h2><div class="periods">${periodCards}</div><table><thead><tr><th>${isItalian?"Anno":"Year"}</th><th>${isItalian?"Risparmio energia":"Energy saving"}</th><th>${isItalian?"Risparmio manutenzione":"Maintenance saving"}</th><th>${isItalian?"Pagamento cliente":"Customer payment"}</th><th>${isItalian?"Cash flow netto":"Net cash flow"}</th><th>${isItalian?"Cash flow cumulato":"Cumulative cash flow"}</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">VIMALUX · ${project.quotationId} · ${project.municipality}</div></div></body></html>`;
    const win=window.open("","_blank");
    if(!win){alert("Please allow pop-ups to generate the quotation.");return;}
    win.document.open(); win.document.write(html); win.document.close(); setQuoteDialog(false);
  }

  const internalNav=[["overview","Overview"],["audit","Audit & Lighting"],["pricing","Pricing"],["finance","Finance"],["customer","Customer Case"],["internal","Internal Approval"],["settings","Settings"]];
  const customerNav=[["overview","Overview"],["audit","Audit & Lighting"],["finance","Finance"],["customer","Customer Case"]];
  const nav=viewMode==="internal"?internalNav:customerNav;

  return <div style={s.shell}>
    <aside style={s.sidebar}>
      <div style={s.brand}><div style={s.logo}>V</div><div><b>VIMALUX</b><span>Quotation Intelligence</span></div></div>
      <div style={s.projectBadge}><span>ACTIVE QUOTATION</span><b>{project.municipality}</b><small>{project.quotationId}</small></div>
      <div style={s.viewBadge}>{viewMode==="internal"?"INTERNAL VIEW":"CUSTOMER VIEW"}</div>
      <nav style={s.sideNav}>{nav.map(([id,label])=><button key={id} style={section===id?s.navActive:s.navButton} onClick={()=>setSection(id)}>{label}</button>)}</nav>
      {viewMode==="internal"&&<><button style={s.upload} onClick={()=>auditRef.current?.click()}>＋ Import audit</button><input hidden ref={auditRef} type="file" accept=".xlsx,.xls,.csv" onChange={importAudit}/></>}
      <div style={s.sidebarFoot}>Calculation model<br/><b>Noleggio Operativo JUNE26</b></div>
    </aside>

    <main style={s.main}>
      <header style={s.topbar}><div><span style={s.eyebrow}>QUOTATION WORKSPACE</span><h1>{project.municipality}</h1><p>Build, validate and approve a complete lighting offer.</p></div><div style={s.topActions}><button style={s.secondary} onClick={toggleView}>{viewMode==="internal"?"Customer view":"Internal view"}</button><button style={s.primary} onClick={()=>setQuoteDialog(true)}>Generate quotation</button></div></header>
      <section style={s.kpis}><Kpi label="Luminaires" value={number(quote.qty)} note="Imported scope"/><Kpi label="Cash price" value={money(quote.cashPrice)} note="Total intervention"/><Kpi label="Monthly payment" value={money(quote.monthly)} note={`${commercial.years} years · ${commercial.interestRate}%`}/><Kpi label="Customer net saving" value={money(quote.customerNet)} note="Per year" positive={quote.customerNet>=0}/><Kpi label="Energy reduction" value={`${number(calc.totals.energyReductionPct,1)}%`} note={`${number(calc.totals.totalEnergySavingKwh/1000)} MWh/year`}/><Kpi label="CO₂ reduction" value={`${number(calc.finance.annualCo2Tonnes,1)} t`} note="Per year"/></section>

      {section==="overview"&&<><div style={s.grid2}><Card title="Offer readiness" subtitle="Core inputs and commercial validation"><Progress label="Audit imported" value={100}/><Progress label="Lighting recommendation" value={92}/><Progress label="Commercial inputs" value={88}/><Progress label="Internal approval" value={quote.mol3>0?100:55}/></Card><Card title="Commercial summary" subtitle="Current selected financing model"><div style={s.summaryRows}><Row label="Model" value={commercial.model}/><Row label="Contract period" value={`${commercial.years} years`}/><Row label="Financed total" value={money(quote.financedTotal)}/><Row label="Annual customer payment" value={money(quote.annualPayment)}/><Row label="Annual customer savings" value={money(quote.customerAnnualSaving)}/></div></Card></div>{viewMode==="internal"&&<Card title="Project setup" subtitle="Customer and quotation identification"><div style={s.formGrid}><Field label="Municipality" value={project.municipality} onChange={value=>setProject(state=>({...state,municipality:value}))}/><Field label="Quotation ID" value={project.quotationId} onChange={value=>setProject(state=>({...state,quotationId:value}))}/><Field label="Contact" value={project.contact} onChange={value=>setProject(state=>({...state,contact:value}))}/><Field label="Country" value={project.country} onChange={value=>setProject(state=>({...state,country:value}))}/></div></Card>}</>}

      {section==="audit"&&<Card title="Audit & lighting recommendation" subtitle="Existing load, effective input power and proposed LED configuration" action={viewMode==="internal"?<button style={s.primary} onClick={()=>auditRef.current?.click()}>Import Excel</button>:null}><div style={s.tableWrap}><table style={s.table}><thead><tr><th>Group</th><th>Qty</th><th>Technology</th><th>Existing W</th><th>Effective W</th><th>Recommendation</th><th>Selected luminaire</th><th>Smart</th><th>PowerAiD</th></tr></thead><tbody>{groups.map(group=>{const result=calc.groups.find(item=>item.groupId===group.id);return <tr key={group.id}><td>{viewMode==="internal"?<input value={group.label} onChange={event=>updateGroup(group.id,"label",event.target.value)}/>:group.label}</td><td>{viewMode==="internal"?<input value={group.quantity} onChange={event=>updateGroup(group.id,"quantity",num(event.target.value))}/>:number(group.quantity)}</td><td>{viewMode==="internal"?<select value={group.existingType} onChange={event=>updateGroup(group.id,"existingType",event.target.value)}><option>SAP</option><option>LED</option><option>MH</option><option>Mercury</option><option>Unknown</option></select>:group.existingType}</td><td>{viewMode==="internal"?<input value={group.existingWatt} onChange={event=>updateGroup(group.id,"existingWatt",num(event.target.value))}/>:`${number(group.existingWatt)} W`}</td><td><b>{number(result?.effectiveExistingWatt)} W</b></td><td><button disabled={viewMode!=="internal"} style={s.recommend} onClick={()=>applyRecommendation(group.id)}>{group.recommendationTargetWatt||"–"}W <span>{group.recommendationConfidence||0}%</span></button></td><td>{viewMode==="internal"?<select value={group.productId} onChange={event=>updateGroup(group.id,"productId",event.target.value)}>{products.map(product=><option key={product.id} value={product.id}>{product.name} · {product.watt}W</option>)}</select>:productMap.get(group.productId)?.name}</td><td><input type="checkbox" checked={group.smart} disabled={viewMode!=="internal"} onChange={event=>updateGroup(group.id,"smart",event.target.checked)}/></td><td><input type="checkbox" checked={group.powerAid} disabled={viewMode!=="internal"||!group.smart} onChange={event=>updateGroup(group.id,"powerAid",event.target.checked)}/></td></tr>})}</tbody></table></div></Card>}

      {section==="pricing"&&viewMode==="internal"&&<><Card title="Commercial inputs" subtitle="Enter project-specific purchase prices, sales prices, freight and commissions"><div style={s.formGrid3}><Field numeric label="Installation cost / lamp" value={commercial.installationCostPerLamp} onChange={value=>updateCommercial("installationCostPerLamp",num(value))}/><Field numeric label="Installation sales / lamp" value={commercial.installationSellPerLamp} onChange={value=>updateCommercial("installationSellPerLamp",num(value))}/><Field numeric label="Freight & duty cost / lamp" value={commercial.freightCostPerLamp} onChange={value=>updateCommercial("freightCostPerLamp",num(value))}/><Field numeric label="Freight & duty sales / lamp" value={commercial.freightSellPerLamp} onChange={value=>updateCommercial("freightSellPerLamp",num(value))}/><Field numeric label="Smart hardware cost / lamp" value={commercial.smartHardwareCostPerLamp} onChange={value=>updateCommercial("smartHardwareCostPerLamp",num(value))}/><Field numeric label="Smart hardware sales / lamp" value={commercial.smartHardwareSellPerLamp} onChange={value=>updateCommercial("smartHardwareSellPerLamp",num(value))}/><Field numeric label="CMS cost / lamp / year" value={commercial.cmsCostPerLampYear} onChange={value=>updateCommercial("cmsCostPerLampYear",num(value))}/><Field numeric label="CMS sales / lamp / year" value={commercial.cmsSellPerLampYear} onChange={value=>updateCommercial("cmsSellPerLampYear",num(value))}/><Field numeric label="PowerAiD cost / lamp / year" value={commercial.powerAidCostPerLampYear} onChange={value=>updateCommercial("powerAidCostPerLampYear",num(value))}/><Field numeric label="PowerAiD sales / lamp / year" value={commercial.powerAidSellPerLampYear} onChange={value=>updateCommercial("powerAidSellPerLampYear",num(value))}/><Field numeric label="Agent commission %" value={commercial.commissionPct} onChange={value=>updateCommercial("commissionPct",num(value))}/><Select label="Commission basis" value={commercial.commissionBasis} options={["Luminaires","Total contract"]} onChange={value=>updateCommercial("commissionBasis",value)}/><Field numeric label="Bonus %" value={commercial.bonusPct} onChange={value=>updateCommercial("bonusPct",num(value))}/><Field numeric label="Overall price adjustment €" value={commercial.overallPriceAdjustment} onChange={value=>updateCommercial("overallPriceAdjustment",num(value))}/></div></Card><Card title="Cost & pricing engine" subtitle="Internal cost, sales price and margin by component"><PriceTable rows={pricingRows(quote)}/></Card></>}

      {section==="finance"&&<div style={s.grid2}><Card title="Financing inputs" subtitle="Noleggio Operativo / financed offer"><div style={s.formGrid}><Select label="Model" value={commercial.model} options={["Noleggio Operativo","Cash purchase","Lighting as a Service","ESCO","PPP"]} onChange={value=>updateCommercial("model",value)}/><Field numeric label="Period (years)" value={commercial.years} onChange={value=>updateCommercial("years",num(value))}/><Field numeric label="Customer interest %" value={commercial.interestRate} onChange={value=>updateCommercial("interestRate",num(value))}/><Field numeric label="Upfront payment" value={commercial.upfront} onChange={value=>updateCommercial("upfront",num(value))}/></div></Card><Card title="Payment result" subtitle="Calculated from the complete intervention"><div style={s.heroNumber}>{money(quote.monthly)}<span>per month</span></div><div style={s.summaryRows}><Row label="Annual payment" value={money(quote.annualPayment)}/><Row label="Financed total" value={money(quote.financedTotal)}/><Row label="Total interest" value={money(quote.interest)}/><Row label="Per luminaire / month" value={money2(quote.monthly/Math.max(1,quote.qty))}/></div></Card></div>}

      {section==="customer"&&<><div style={s.grid2}><Card title="Customer business case" subtitle="Visible in the commercial quotation"><div style={s.summaryRows}><Row label="Energy saving / year" value={money(calc.totals.totalEnergySavingValue)}/><Row label="Maintenance saving / year" value={money(quote.maintenanceSaving)}/><Row label="Total saving / year" value={money(quote.customerAnnualSaving)}/><Row label="Annual payment" value={money(quote.annualPayment)}/><Row label="Net benefit / year" value={money(quote.customerNet)} highlight/></div></Card><Card title="Environmental impact" subtitle="Annual verified calculation"><div style={s.heroNumber}>{number(calc.finance.annualCo2Tonnes,1)} t<span>CO₂ avoided per year</span></div><div style={s.summaryRows}><Row label="Baseline consumption" value={`${number(calc.totals.baselineKwh/1000)} MWh`}/><Row label="New grid consumption" value={`${number(calc.totals.residualGridKwh/1000)} MWh`}/><Row label="Energy reduction" value={`${number(calc.totals.energyReductionPct,1)}%`}/><Row label={`CO₂ reduction over ${commercial.years} years`} value={`${number(calc.finance.annualCo2Tonnes*commercial.years,1)} t`}/></div></Card></div><Card title="Customer cash flow after payment" subtitle="Annual and accumulated benefit over 20 years"><CashflowTable rows={quote.yearly}/></Card></>}

      {section==="internal"&&viewMode==="internal"&&<><section style={s.approvalHero}><div><span>APPROVAL STATUS</span><b style={{color:quote.mol3>0?"#0f8a5f":"#b42318"}}>{quote.mol3>0?"APPROVABLE":"REVIEW REQUIRED"}</b><small>Restricted VIMALUX management view</small></div><ApprovalMetric label="Revenue" value={money(quote.cashPrice)}/><ApprovalMetric label="Direct cost" value={money(quote.totalCost)}/><ApprovalMetric label="Gross margin" value={money(quote.grossMargin)} note={`${number(quote.cashPrice?quote.grossMargin/quote.cashPrice*100:0,1)}%`}/><ApprovalMetric label="MOL 3" value={money(quote.mol3)} note={`${number(quote.cashPrice?quote.mol3/quote.cashPrice*100:0,1)}%`}/></section><div style={s.grid2}><Card title="Margin bridge" subtitle="From gross margin to final MOL 3"><div style={s.summaryRows}><Row label="Gross margin / MOL 1" value={money(quote.mol1)}/><Row label="Agent commission" value={`− ${money(quote.commission)}`}/><Row label="Bonus" value={`− ${money(quote.bonus)}`}/><Row label="MOL 2" value={money(quote.mol2)}/><Row label="Finance partner cost" value={`− ${money(quote.financeCost)}`}/><Row label="MOL 3" value={money(quote.mol3)} highlight/></div></Card><Card title="Approval checks" subtitle="Commercial thresholds and capital exposure"><div style={s.summaryRows}><Row label="Gross margin %" value={`${number(quote.cashPrice?quote.grossMargin/quote.cashPrice*100:0,1)}%`}/><Row label="MOL 3 %" value={`${number(quote.cashPrice?quote.mol3/quote.cashPrice*100:0,1)}%`}/><Row label="Required initial CAPEX" value={money(quote.totalCost)}/><Row label="Financed customer total" value={money(quote.financedTotal)}/><Row label="Total customer interest" value={money(quote.interest)}/></div></Card></div><Card title="Detailed commercial economics" subtitle="Component-level cost and margin"><PriceTable rows={pricingRows(quote)}/></Card></>}

      {section==="settings"&&viewMode==="internal"&&<div style={s.grid2}><Card title="Financial assumptions" subtitle="Project-level financing and recurring service parameters"><div style={s.formGrid}><Field numeric label="Maintenance after / lamp / year" value={commercial.maintenanceAfterPerLamp} onChange={value=>updateCommercial("maintenanceAfterPerLamp",num(value))}/><Field numeric label="Sell-off cost %" value={commercial.financeSellOffPct} onChange={value=>updateCommercial("financeSellOffPct",num(value))}/><Field numeric label="Saving indexation %" value={assumptions.savingIndexationPct} onChange={value=>setAssumptions(state=>({...state,savingIndexationPct:num(value)}))}/><Field numeric label="Energy price / kWh" value={assumptions.energyPrice} onChange={value=>setAssumptions(state=>({...state,energyPrice:num(value)}))}/></div></Card><Card title="Technical assumptions" subtitle="Energy and lighting calculation"><div style={s.formGrid}>{["burningHours","maintenanceOldPerLamp","cloSavingPct","smartSolutionSavingPct","powerAidAdditionalSavingPct","sapBallastFactor","co2KgPerKwh"].map(key=><Field key={key} numeric label={key} value={assumptions[key]} onChange={value=>setAssumptions(state=>({...state,[key]:num(value)}))}/>)}</div></Card></div>}
    </main>

    {quoteDialog&&<div style={s.modalBackdrop}><div style={s.modal}><div style={s.cardHead}><div><h2>Generate quotation</h2><p>Create a customer-ready quotation with cashflow and CO₂ results.</p></div><button style={s.iconButton} onClick={()=>setQuoteDialog(false)}>×</button></div><div style={s.formGrid}><Select label="Language" value={quoteLanguage} options={["it","en"]} onChange={setQuoteLanguage}/><div style={s.field}><span>Output</span><div style={s.outputBox}>Printable quotation / Save as PDF</div></div></div><div style={{marginTop:18}}><b>Cashflow comparison periods</b><div style={s.periodChecks}>{[5,9,10,15,20].map(period=><label key={period}><input type="checkbox" checked={selectedPeriods.includes(period)} onChange={event=>setSelectedPeriods(list=>event.target.checked?[...list,period].sort((a,b)=>a-b):list.filter(item=>item!==period))}/>{period} years</label>)}</div></div><div style={s.modalActions}><button style={s.secondary} onClick={()=>setQuoteDialog(false)}>Cancel</button><button style={s.primary} onClick={generateQuotation}>Generate quotation</button></div></div></div>}
  </div>;
}

const pricingRows=quote=>[["LED luminaires",quote.lumCost,quote.lumSell],["CityManager hardware",quote.smartCost,quote.smartSell],["CMS, connectivity & support",quote.cmsCost,quote.cmsSell],["PowerAiD service",quote.powerCost,quote.powerSell],["Installation",quote.installCost,quote.installSell],["Freight & duty",quote.freightCost,quote.freightSell]];
function Kpi({label,value,note,positive}){return <div style={s.kpi}><span>{label}</span><b style={positive?{color:"#0f8a5f"}:undefined}>{value}</b><small>{note}</small></div>}
function Card({title,subtitle,action,children}){return <section style={s.card}><div style={s.cardHead}><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>}
function Field({label,value,onChange,numeric}){return <label style={s.field}><span>{label}</span><input inputMode={numeric?"decimal":"text"} value={value??""} onChange={event=>onChange(event.target.value)}/></label>}
function Select({label,value,onChange,options}){return <label style={s.field}><span>{label}</span><select value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option} value={option}>{option}</option>)}</select></label>}
function Row({label,value,highlight}){return <div style={highlight?{...s.row,...s.rowHighlight}:s.row}><span>{label}</span><b>{value}</b></div>}
function Progress({label,value}){return <div style={s.progress}><div><span>{label}</span><b>{value}%</b></div><i><em style={{width:`${value}%`}}/></i></div>}
function ApprovalMetric({label,value,note}){return <div style={s.approvalMetric}><span>{label}</span><b>{value}</b>{note&&<small>{note}</small>}</div>}
function PriceTable({rows}){return <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Component</th><th>Cost</th><th>Sales price</th><th>Margin</th><th>Margin %</th></tr></thead><tbody>{rows.map(([name,cost,sell])=>{const margin=sell-cost;return <tr key={name}><td><b>{name}</b></td><td>{money(cost)}</td><td>{money(sell)}</td><td>{money(margin)}</td><td>{sell?`${number(margin/sell*100,1)}%`:"–"}</td></tr>})}</tbody></table></div>}
function CashflowTable({rows}){return <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Year</th><th>Energy saving</th><th>Maintenance saving</th><th>Customer payment</th><th>Net cash flow</th><th>Accumulated</th><th>CO₂ accumulated</th></tr></thead><tbody>{rows.map(row=><tr key={row.year}><td>{row.year}</td><td>{money(row.indexedEnergy)}</td><td>{money(row.maintenanceSaving)}</td><td>{money(row.customerPayment)}</td><td style={{fontWeight:800,color:row.netCashflow>=0?"#0f8a5f":"#b42318"}}>{money(row.netCashflow)}</td><td>{money(row.cumulative)}</td><td>{number(row.cumulativeCo2,1)} t</td></tr>)}</tbody></table></div>}

const s={
  shell:{minHeight:"100vh",display:"flex",background:"#f3f6f8",color:"#102a2e",fontFamily:"Inter,Arial,sans-serif"},
  sidebar:{position:"fixed",inset:"0 auto 0 0",width:238,background:"#0d2b2f",color:"white",padding:20,boxSizing:"border-box",display:"flex",flexDirection:"column",zIndex:5},
  brand:{display:"flex",gap:11,alignItems:"center",padding:"4px 4px 22px"},logo:{width:38,height:38,borderRadius:10,background:"#c9f15a",color:"#0d2b2f",display:"grid",placeItems:"center",fontWeight:900,fontSize:21},
  projectBadge:{display:"grid",gap:5,padding:14,border:"1px solid #27494d",background:"#15373b",borderRadius:12,marginBottom:10},viewBadge:{fontSize:10,fontWeight:800,letterSpacing:1,padding:"7px 10px",color:"#c9f15a",marginBottom:12},sideNav:{display:"grid",gap:5},
  navButton:{border:0,background:"transparent",color:"#b8c8ca",padding:"11px 12px",borderRadius:9,textAlign:"left",cursor:"pointer"},navActive:{border:0,background:"#c9f15a",color:"#102a2e",padding:"11px 12px",borderRadius:9,textAlign:"left",fontWeight:800,cursor:"pointer"},
  upload:{marginTop:18,padding:12,borderRadius:9,border:"1px dashed #5d777a",background:"transparent",color:"white",cursor:"pointer"},sidebarFoot:{marginTop:"auto",fontSize:11,color:"#8da4a6",lineHeight:1.5},
  main:{marginLeft:238,width:"calc(100% - 238px)",padding:"30px 34px 60px",boxSizing:"border-box"},topbar:{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",marginBottom:24},eyebrow:{fontSize:11,fontWeight:800,letterSpacing:1.4,color:"#668084"},topActions:{display:"flex",gap:10},
  primary:{border:0,background:"#0d2b2f",color:"white",padding:"11px 15px",borderRadius:9,fontWeight:700,cursor:"pointer"},secondary:{border:"1px solid #cad6d8",background:"white",padding:"10px 14px",borderRadius:9,fontWeight:700,cursor:"pointer"},
  kpis:{display:"grid",gridTemplateColumns:"repeat(6,minmax(130px,1fr))",gap:12,marginBottom:18},kpi:{background:"white",border:"1px solid #dfe7e8",borderRadius:13,padding:16,display:"grid",gap:7},
  card:{background:"white",border:"1px solid #dfe7e8",borderRadius:15,padding:20,marginBottom:16,boxShadow:"0 4px 18px rgba(15,42,46,.035)"},cardHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18},
  grid2:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16},formGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(150px,1fr))",gap:13},formGrid3:{display:"grid",gridTemplateColumns:"repeat(3,minmax(150px,1fr))",gap:13},field:{display:"grid",gap:6,fontSize:12,fontWeight:700,color:"#52696c"},
  tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:760},recommend:{background:"#eff8d8",border:"1px solid #d6ec9b",padding:"7px 10px",borderRadius:8,fontWeight:800},
  summaryRows:{display:"grid"},row:{display:"flex",justifyContent:"space-between",gap:15,padding:"11px 0",borderBottom:"1px solid #edf1f2"},rowHighlight:{background:"#eff8d8",padding:"13px 12px",borderRadius:9,border:0,marginTop:7},heroNumber:{fontSize:34,fontWeight:850,color:"#0d2b2f",display:"grid",gap:5,marginBottom:12},
  progress:{display:"grid",gap:7,marginBottom:14},approvalHero:{display:"grid",gridTemplateColumns:"1.2fr repeat(4,1fr)",gap:12,marginBottom:16},approvalMetric:{padding:17,border:"1px solid #dfe7e8",background:"white",borderRadius:13,display:"grid",gap:7},
  modalBackdrop:{position:"fixed",inset:0,background:"rgba(13,43,47,.58)",display:"grid",placeItems:"center",zIndex:30,padding:20},modal:{width:"min(650px,100%)",background:"white",borderRadius:16,padding:22,boxShadow:"0 30px 80px rgba(0,0,0,.25)"},iconButton:{border:0,background:"#edf2f2",width:34,height:34,borderRadius:9,fontSize:22,cursor:"pointer"},outputBox:{padding:10,border:"1px solid #cad6d8",borderRadius:8,background:"#f8fafa"},periodChecks:{display:"flex",flexWrap:"wrap",gap:12,marginTop:10},modalActions:{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22},
};

const style=document.createElement("style");
style.textContent=`*{box-sizing:border-box}body{margin:0}h1{margin:3px 0 5px;font-size:29px}h2{margin:0;font-size:17px}p{margin:0;color:#6e8285;font-size:13px}.projectBadge span,.projectBadge small{font-size:10px;color:#91a9ab}.projectBadge b{font-size:13px}.kpi span{font-size:11px;color:#6c8184;text-transform:uppercase;letter-spacing:.5px}.kpi b{font-size:20px}.kpi small{font-size:11px;color:#849699}input,select{width:100%;border:1px solid #cad6d8;border-radius:8px;padding:9px;background:white;color:#17363a}input[type=checkbox]{width:16px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#708487;padding:10px;border-bottom:1px solid #dce5e6}td{padding:10px;border-bottom:1px solid #edf1f2;font-size:12px}.progress>div{display:flex;justify-content:space-between;font-size:12px}.progress i{height:7px;background:#edf2f2;border-radius:8px;overflow:hidden}.progress em{display:block;height:100%;background:#0d2b2f;border-radius:8px}.approvalHero>div:first-child{padding:17px;border-radius:13px;background:#eff8d8;display:grid;gap:7px}.approvalHero span,.approvalMetric span{font-size:10px;color:#718588;text-transform:uppercase;letter-spacing:.5px}.approvalHero b,.approvalMetric b{font-size:19px}.approvalHero small,.approvalMetric small{color:#718588;font-size:11px}@media(max-width:1200px){.kpis{grid-template-columns:repeat(3,1fr)!important}.formGrid3{grid-template-columns:repeat(2,1fr)!important}.approvalHero{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:900px){.grid2{grid-template-columns:1fr!important}}@media(max-width:760px){.sidebar{position:static!important;width:100%!important}.shell{display:block!important}.main{margin:0!important;width:100%!important;padding:18px!important}.kpis{grid-template-columns:repeat(2,1fr)!important}.topbar{align-items:flex-start!important;flex-direction:column!important}.formGrid3{grid-template-columns:1fr!important}}`;
if(typeof document!=="undefined"&&!document.getElementById("vimalux-enterprise-css")){style.id="vimalux-enterprise-css";document.head.appendChild(style);}
