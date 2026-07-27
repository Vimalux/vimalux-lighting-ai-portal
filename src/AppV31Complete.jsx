import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { auditRowsToManualGroups, calculateManualProject, createManualGroup, recommendProduct } from "./v31ManualProjectEngine.js";

const PRODUCTS = [
  { id:"street20", name:"VIMALUX Street 20", watt:20, lumen:3200, sellPrice:155, buyPrice:85, install:25 },
  { id:"street30", name:"VIMALUX Street 30", watt:30, lumen:4800, sellPrice:165, buyPrice:92, install:25 },
  { id:"street40", name:"VIMALUX Street 40", watt:40, lumen:6400, sellPrice:175, buyPrice:100, install:25 },
  { id:"street60", name:"VIMALUX Street 60", watt:60, lumen:9600, sellPrice:190, buyPrice:110, install:25 },
  { id:"road90", name:"VIMALUX Road 90", watt:90, lumen:14400, sellPrice:210, buyPrice:150, install:30 },
  { id:"highway120", name:"VIMALUX Highway 120", watt:120, lumen:19200, sellPrice:285, buyPrice:205, install:35 },
  { id:"highway150", name:"VIMALUX Highway 150", watt:150, lumen:24000, sellPrice:320, buyPrice:230, install:35 },
];

const DEFAULTS = {
  ledSavingPct:55, cloSavingPct:10, smartSolutionSavingPct:20, maintenanceOldPerLamp:25,
  maintenanceSavingPct:40, powerAidAdditionalSavingPct:40, energyPrice:0.29, burningHours:4200,
  smartNodeCost:62, cmsFeePerLampYear:6, powerAidFeePerLampYear:3, hybridProductionKwhPerLampYear:70,
  hybridAdditionalCapexPerLamp:0, analysisYears:20, savingIndexationPct:0, discountRatePct:6,
  performanceDegradationPct:0, co2KgPerKwh:0.233, sapBallastFactor:1.2, mhBallastFactor:1.15,
  mercuryBallastFactor:1.15, fluorescentBallastFactor:1.1, ledBallastFactor:1, unknownBallastFactor:1,
};

const euro = v => new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(v)||0);
const number = (v,d=0) => new Intl.NumberFormat("it-IT",{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(v)||0);
const num = v => Number(String(v??"").replace(",","."))||0;

function payment(principal, annualRate, years){
  const months=Math.max(1,Math.round(years*12)); const r=(annualRate/100)/12;
  return r===0 ? principal/months : principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1);
}

export default function AppV31Complete(){
  const [section,setSection]=useState("overview");
  const [internal,setInternal]=useState(false);
  const [project,setProject]=useState({municipality:"Comune di Larciano",quotationId:"Q-2026-001",contact:"",country:"Italy"});
  const [products,setProducts]=useState(PRODUCTS);
  const [assumptions,setAssumptions]=useState(DEFAULTS);
  const [commercial,setCommercial]=useState({model:"Noleggio Operativo",years:9,interestRate:8,upfront:0,freightDuty:11,installationSell:30,maintenanceSell:15,commissionPct:0,bonusPct:8,financeSellOffPct:8,stockPct:0});
  const [groups,setGroups]=useState([createManualGroup(1,{label:"Street lighting",quantity:1182,existingType:"SAP",existingWatt:100,productId:"street40",smart:true,powerAid:true,hybrid:false,recommendationTargetWatt:40,recommendationConfidence:85})]);
  const auditRef=useRef(null);
  const calc=useMemo(()=>calculateManualProject(groups,assumptions,products),[groups,assumptions,products]);
  const productMap=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);

  const quote=useMemo(()=>{
    const qty=calc.totals.quantity;
    const lumSell=calc.totals.luminaireCapex;
    const lumCost=groups.reduce((s,g)=>s+num(g.quantity)*num(productMap.get(g.productId)?.buyPrice),0);
    const smartSell=calc.totals.smartCapex;
    const smartCost=groups.reduce((s,g)=>s+(g.smart?num(g.quantity)*30:0),0);
    const installSell=qty*commercial.installationSell;
    const installCost=qty*25;
    const freightSell=qty*commercial.freightDuty;
    const freightCost=freightSell;
    const cmsSell=groups.reduce((s,g)=>s+(g.smart?num(g.quantity)*assumptions.cmsFeePerLampYear*commercial.years:0),0);
    const cmsCost=cmsSell*0.57;
    const powerSell=groups.reduce((s,g)=>s+(g.smart&&g.powerAid?num(g.quantity)*assumptions.powerAidFeePerLampYear*commercial.years:0),0);
    const powerCost=powerSell*0.08;
    const cashPrice=lumSell+smartSell+installSell+freightSell+cmsSell+powerSell;
    const principal=Math.max(0,cashPrice-commercial.upfront);
    const monthly=payment(principal,commercial.interestRate,commercial.years);
    const financedTotal=monthly*commercial.years*12+commercial.upfront;
    const interest=financedTotal-cashPrice;
    const annualPayment=monthly*12;
    const maintenanceBefore=qty*assumptions.maintenanceOldPerLamp;
    const maintenanceAfter=qty*commercial.maintenanceSell;
    const maintenanceSaving=Math.max(0,maintenanceBefore-maintenanceAfter);
    const customerAnnualSaving=calc.totals.totalEnergySavingValue+maintenanceSaving;
    const customerNet=customerAnnualSaving-annualPayment;
    const totalCost=lumCost+smartCost+installCost+freightCost+cmsCost+powerCost;
    const commission=lumSell*commercial.commissionPct/100;
    const bonus=(cashPrice-freightSell)*commercial.bonusPct/100;
    const financeCost=interest*commercial.financeSellOffPct/100;
    const grossMargin=cashPrice-totalCost;
    const mol2=grossMargin-commission-bonus;
    const mol3=mol2-financeCost;
    return {qty,lumSell,lumCost,smartSell,smartCost,installSell,installCost,freightSell,freightCost,cmsSell,cmsCost,powerSell,powerCost,cashPrice,principal,monthly,annualPayment,financedTotal,interest,maintenanceBefore,maintenanceAfter,maintenanceSaving,customerAnnualSaving,customerNet,totalCost,commission,bonus,financeCost,grossMargin,mol2,mol3};
  },[calc,groups,products,productMap,assumptions,commercial]);

  const updateGroup=(id,key,value)=>setGroups(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r));
  const updateCommercial=(key,value)=>setCommercial(s=>({...s,[key]:value}));
  const applyRecommendation=id=>setGroups(rows=>rows.map(g=>{if(g.id!==id)return g; const r=recommendProduct(g.existingType,g.existingWatt,products);return {...g,productId:r.productId||g.productId,recommendationTargetWatt:r.targetWatt,recommendationConfidence:r.confidence};}));

  async function importAudit(e){
    const file=e.target.files?.[0]; if(!file)return;
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const preferred=wb.SheetNames.includes("Luminaire_Audit")?"Luminaire_Audit":wb.SheetNames[0];
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[preferred],{defval:""});
    const normalized=rows.map((r,i)=>({label:r.Group||r.Name||r.ID||r.Pole_ID||`Group ${i+1}`,quantity:num(r.Quantity||r.Qty||1),existingType:r.Existing_Type||r.Technology||r.Tecnologia||r.Lamp_Type||r.Type||"Unknown",existingWatt:num(r.Existing_Watt||r.Wattage||r.Watt||r.Power)})).filter(r=>r.existingWatt>0);
    const imported=auditRowsToManualGroups(normalized,products); if(imported.length)setGroups(imported); setSection("audit"); e.target.value="";
  }

  const nav=[
    ["overview","Overview"],["audit","Audit & Lighting"],["pricing","Pricing"],["finance","Finance"],["customer","Customer Case"],["internal","Internal Approval"],["settings","Settings"]
  ];

  return <div style={s.shell}>
    <aside style={s.sidebar}>
      <div style={s.brand}><div style={s.logo}>V</div><div><b>VIMALUX</b><span>Quotation Intelligence</span></div></div>
      <div style={s.projectBadge}><span>ACTIVE QUOTATION</span><b>{project.municipality}</b><small>{project.quotationId}</small></div>
      <nav style={s.sideNav}>{nav.map(([id,label])=><button key={id} style={section===id?s.navActive:s.navButton} onClick={()=>setSection(id)}>{label}</button>)}</nav>
      <button style={s.upload} onClick={()=>auditRef.current?.click()}>＋ Import audit</button>
      <input hidden ref={auditRef} type="file" accept=".xlsx,.xls,.csv" onChange={importAudit}/>
      <div style={s.sidebarFoot}>Calculation model<br/><b>Noleggio Operativo JUNE26</b></div>
    </aside>

    <main style={s.main}>
      <header style={s.topbar}>
        <div><span style={s.eyebrow}>QUOTATION WORKSPACE</span><h1>{project.municipality}</h1><p>Build, validate and approve a complete lighting offer.</p></div>
        <div style={s.topActions}><button style={s.secondary} onClick={()=>setInternal(!internal)}>{internal?"Customer view":"Internal view"}</button><button style={s.primary}>Generate quotation</button></div>
      </header>

      <section style={s.kpis}>
        <Kpi label="Luminaires" value={number(quote.qty)} note="Imported scope"/>
        <Kpi label="Cash price" value={euro(quote.cashPrice)} note="Total intervention"/>
        <Kpi label="Monthly payment" value={euro(quote.monthly)} note={`${commercial.years} years · ${commercial.interestRate}%`}/>
        <Kpi label="Customer net saving" value={euro(quote.customerNet)} note="Per year" positive={quote.customerNet>=0}/>
        <Kpi label="Energy reduction" value={`${number(calc.totals.energyReductionPct,1)}%`} note={`${number(calc.totals.totalEnergySavingKwh/1000)} MWh/year`}/>
        <Kpi label="CO₂ reduction" value={`${number(calc.finance.annualCo2Tonnes,1)} t`} note="Per year"/>
      </section>

      {section==="overview"&&<>
        <div style={s.grid2}>
          <Card title="Offer readiness" subtitle="Core inputs and commercial validation">
            <Progress label="Audit imported" value={100}/><Progress label="Lighting recommendation" value={92}/><Progress label="Commercial inputs" value={88}/><Progress label="Internal approval" value={quote.mol3>0?100:55}/>
          </Card>
          <Card title="Commercial summary" subtitle="Current selected financing model">
            <div style={s.summaryRows}><Row label="Model" value={commercial.model}/><Row label="Contract period" value={`${commercial.years} years`}/><Row label="Financed total" value={euro(quote.financedTotal)}/><Row label="Annual customer payment" value={euro(quote.annualPayment)}/><Row label="Annual customer savings" value={euro(quote.customerAnnualSaving)}/></div>
          </Card>
        </div>
        <Card title="Project setup" subtitle="Customer and quotation identification">
          <div style={s.formGrid}><Field label="Municipality" value={project.municipality} onChange={v=>setProject(p=>({...p,municipality:v}))}/><Field label="Quotation ID" value={project.quotationId} onChange={v=>setProject(p=>({...p,quotationId:v}))}/><Field label="Contact" value={project.contact} onChange={v=>setProject(p=>({...p,contact:v}))}/><Field label="Country" value={project.country} onChange={v=>setProject(p=>({...p,country:v}))}/></div>
        </Card>
      </>}

      {section==="audit"&&<Card title="Audit & lighting recommendation" subtitle="Existing load, effective input power and proposed LED configuration" action={<button style={s.primary} onClick={()=>auditRef.current?.click()}>Import Excel</button>}>
        <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Group</th><th>Qty</th><th>Technology</th><th>Existing W</th><th>Effective W</th><th>Recommendation</th><th>Selected luminaire</th><th>Smart</th><th>PowerAiD</th></tr></thead><tbody>{groups.map(g=>{const result=calc.groups.find(x=>x.groupId===g.id);return <tr key={g.id}><td><input value={g.label} onChange={e=>updateGroup(g.id,"label",e.target.value)}/></td><td><input value={g.quantity} onChange={e=>updateGroup(g.id,"quantity",num(e.target.value))}/></td><td><select value={g.existingType} onChange={e=>updateGroup(g.id,"existingType",e.target.value)}><option>SAP</option><option>LED</option><option>MH</option><option>Mercury</option><option>Unknown</option></select></td><td><input value={g.existingWatt} onChange={e=>updateGroup(g.id,"existingWatt",num(e.target.value))}/></td><td><b>{number(result?.effectiveExistingWatt,0)} W</b></td><td><button style={s.recommend} onClick={()=>applyRecommendation(g.id)}>{g.recommendationTargetWatt||"–"}W <span>{g.recommendationConfidence||0}%</span></button></td><td><select value={g.productId} onChange={e=>updateGroup(g.id,"productId",e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.watt}W</option>)}</select></td><td><input type="checkbox" checked={g.smart} onChange={e=>updateGroup(g.id,"smart",e.target.checked)}/></td><td><input type="checkbox" checked={g.powerAid} disabled={!g.smart} onChange={e=>updateGroup(g.id,"powerAid",e.target.checked)}/></td></tr>})}</tbody></table></div>
        <button style={s.add} onClick={()=>setGroups(r=>[...r,createManualGroup(r.length+1,{productId:products[0].id})])}>＋ Add lighting group</button>
      </Card>}

      {section==="pricing"&&<Card title="Cost & pricing engine" subtitle="Commercial build-up replacing the Excel pricing sheets">
        <PriceTable rows={[
          ["LED luminaires",quote.lumCost,quote.lumSell],["CityManager hardware",quote.smartCost,quote.smartSell],["CMS, connectivity & support",quote.cmsCost,quote.cmsSell],["PowerAiD service",quote.powerCost,quote.powerSell],["Installation",quote.installCost,quote.installSell],["Freight & duty",quote.freightCost,quote.freightSell]
        ]}/>
      </Card>}

      {section==="finance"&&<div style={s.grid2}>
        <Card title="Financing inputs" subtitle="Noleggio Operativo / financed offer"><div style={s.formGrid}><Select label="Model" value={commercial.model} options={["Noleggio Operativo","Cash purchase","Lighting as a Service","ESCO","PPP"]} onChange={v=>updateCommercial("model",v)}/><Field numeric label="Period (years)" value={commercial.years} onChange={v=>updateCommercial("years",num(v))}/><Field numeric label="Customer interest %" value={commercial.interestRate} onChange={v=>updateCommercial("interestRate",num(v))}/><Field numeric label="Upfront payment" value={commercial.upfront} onChange={v=>updateCommercial("upfront",num(v))}/></div></Card>
        <Card title="Payment result" subtitle="Calculated from the complete intervention"><div style={s.heroNumber}>{euro(quote.monthly)}<span>per month</span></div><div style={s.summaryRows}><Row label="Annual payment" value={euro(quote.annualPayment)}/><Row label="Financed total" value={euro(quote.financedTotal)}/><Row label="Total interest" value={euro(quote.interest)}/><Row label="Per luminaire / month" value={euro(quote.monthly/Math.max(1,quote.qty))}/></div></Card>
      </div>}

      {section==="customer"&&<div style={s.grid2}>
        <Card title="Customer business case" subtitle="Visible in the commercial quotation"><div style={s.summaryRows}><Row label="Energy saving / year" value={euro(calc.totals.totalEnergySavingValue)}/><Row label="Maintenance saving / year" value={euro(quote.maintenanceSaving)}/><Row label="Total saving / year" value={euro(quote.customerAnnualSaving)}/><Row label="Annual payment" value={euro(quote.annualPayment)}/><Row label="Net benefit / year" value={euro(quote.customerNet)} highlight/></div></Card>
        <Card title="Environmental impact" subtitle="Annual verified calculation"><div style={s.heroNumber}>{number(calc.finance.annualCo2Tonnes,1)} t<span>CO₂ avoided per year</span></div><div style={s.summaryRows}><Row label="Baseline consumption" value={`${number(calc.totals.baselineKwh/1000)} MWh`}/><Row label="New grid consumption" value={`${number(calc.totals.residualGridKwh/1000)} MWh`}/><Row label="Energy reduction" value={`${number(calc.totals.energyReductionPct,1)}%`}/></div></Card>
      </div>}

      {section==="internal"&&<Card title="Internal management approval" subtitle="Restricted VIMALUX economics and margin control">
        <div style={s.approval}><div><span>STATUS</span><b>{quote.mol3>0?"APPROVABLE":"REVIEW REQUIRED"}</b></div><div><span>MOL 3</span><b>{euro(quote.mol3)}</b></div><div><span>MOL 3 %</span><b>{number(quote.cashPrice?quote.mol3/quote.cashPrice*100:0,1)}%</b></div></div>
        <PriceTable rows={[["Gross revenue",0,quote.cashPrice],["Total direct costs",quote.totalCost,0],["Gross margin",0,quote.grossMargin],["Commission",quote.commission,0],["Bonus",quote.bonus,0],["Finance partner cost",quote.financeCost,0],["MOL 3",0,quote.mol3]]}/>
      </Card>}

      {section==="settings"&&<div style={s.grid2}>
        <Card title="Commercial assumptions" subtitle="Editable project-level parameters"><div style={s.formGrid}><Field numeric label="Installation sell / lamp" value={commercial.installationSell} onChange={v=>updateCommercial("installationSell",num(v))}/><Field numeric label="Freight & duty / lamp" value={commercial.freightDuty} onChange={v=>updateCommercial("freightDuty",num(v))}/><Field numeric label="Maintenance after / lamp" value={commercial.maintenanceSell} onChange={v=>updateCommercial("maintenanceSell",num(v))}/><Field numeric label="Agent commission %" value={commercial.commissionPct} onChange={v=>updateCommercial("commissionPct",num(v))}/><Field numeric label="Bonus %" value={commercial.bonusPct} onChange={v=>updateCommercial("bonusPct",num(v))}/><Field numeric label="Sell-off cost %" value={commercial.financeSellOffPct} onChange={v=>updateCommercial("financeSellOffPct",num(v))}/></div></Card>
        <Card title="Technical assumptions" subtitle="Energy and lighting calculation"><div style={s.formGrid}>{["energyPrice","burningHours","maintenanceOldPerLamp","cloSavingPct","smartSolutionSavingPct","powerAidAdditionalSavingPct","sapBallastFactor","co2KgPerKwh"].map(k=><Field key={k} numeric label={k} value={assumptions[k]} onChange={v=>setAssumptions(a=>({...a,[k]:num(v)}))}/>)}</div></Card>
      </div>}
    </main>
  </div>;
}

function Kpi({label,value,note,positive}){return <div style={s.kpi}><span>{label}</span><b style={positive?{color:"#0f8a5f"}:undefined}>{value}</b><small>{note}</small></div>}
function Card({title,subtitle,action,children}){return <section style={s.card}><div style={s.cardHead}><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>}
function Field({label,value,onChange,numeric}){return <label style={s.field}><span>{label}</span><input inputMode={numeric?"decimal":"text"} value={value??""} onChange={e=>onChange(e.target.value)}/></label>}
function Select({label,value,onChange,options}){return <label style={s.field}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>}
function Row({label,value,highlight}){return <div style={highlight?{...s.row,...s.rowHighlight}:s.row}><span>{label}</span><b>{value}</b></div>}
function Progress({label,value}){return <div style={s.progress}><div><span>{label}</span><b>{value}%</b></div><i><em style={{width:`${value}%`}}/></i></div>}
function PriceTable({rows}){return <div style={s.tableWrap}><table style={s.table}><thead><tr><th>Component</th><th>Cost</th><th>Sales price</th><th>Margin</th><th>Margin %</th></tr></thead><tbody>{rows.map(([name,cost,sell])=>{const margin=sell-cost;return <tr key={name}><td><b>{name}</b></td><td>{euro(cost)}</td><td>{euro(sell)}</td><td>{euro(margin)}</td><td>{sell?number(margin/sell*100,1)+"%":"–"}</td></tr>})}</tbody></table></div>}

const s={
  shell:{minHeight:"100vh",display:"flex",background:"#f3f6f8",color:"#102a2e",fontFamily:"Inter,Arial,sans-serif"},
  sidebar:{position:"fixed",inset:"0 auto 0 0",width:238,background:"#0d2b2f",color:"white",padding:20,boxSizing:"border-box",display:"flex",flexDirection:"column",zIndex:5},
  brand:{display:"flex",gap:11,alignItems:"center",padding:"4px 4px 22px"},logo:{width:38,height:38,borderRadius:10,background:"#c9f15a",color:"#0d2b2f",display:"grid",placeItems:"center",fontWeight:900,fontSize:21},
  projectBadge:{display:"grid",gap:5,padding:14,border:"1px solid #27494d",background:"#15373b",borderRadius:12,marginBottom:18},sideNav:{display:"grid",gap:5},
  navButton:{border:0,background:"transparent",color:"#b8c8ca",padding:"11px 12px",borderRadius:9,textAlign:"left",cursor:"pointer"},navActive:{border:0,background:"#c9f15a",color:"#102a2e",padding:"11px 12px",borderRadius:9,textAlign:"left",fontWeight:800,cursor:"pointer"},
  upload:{marginTop:18,padding:12,borderRadius:9,border:"1px dashed #5d777a",background:"transparent",color:"white",cursor:"pointer"},sidebarFoot:{marginTop:"auto",fontSize:11,color:"#8da4a6",lineHeight:1.5},
  main:{marginLeft:238,width:"calc(100% - 238px)",padding:"30px 34px 60px",boxSizing:"border-box"},topbar:{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",marginBottom:24},eyebrow:{fontSize:11,fontWeight:800,letterSpacing:1.4,color:"#668084"},topActions:{display:"flex",gap:10},
  primary:{border:0,background:"#0d2b2f",color:"white",padding:"11px 15px",borderRadius:9,fontWeight:700,cursor:"pointer"},secondary:{border:"1px solid #cad6d8",background:"white",padding:"10px 14px",borderRadius:9,fontWeight:700,cursor:"pointer"},
  kpis:{display:"grid",gridTemplateColumns:"repeat(6,minmax(130px,1fr))",gap:12,marginBottom:18},kpi:{background:"white",border:"1px solid #dfe7e8",borderRadius:13,padding:16,display:"grid",gap:7},
  card:{background:"white",border:"1px solid #dfe7e8",borderRadius:15,padding:20,marginBottom:16,boxShadow:"0 4px 18px rgba(15,42,46,.035)"},cardHead:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:18},
  grid2:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16},formGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(150px,1fr))",gap:13},field:{display:"grid",gap:6,fontSize:12,fontWeight:700,color:"#52696c"},
  tableWrap:{overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:760},recommend:{background:"#eff8d8",border:"1px solid #d6ec9b",padding:"7px 10px",borderRadius:8,fontWeight:800},add:{marginTop:14,border:"1px dashed #9bb0b3",background:"white",padding:10,borderRadius:8},
  summaryRows:{display:"grid"},row:{display:"flex",justifyContent:"space-between",gap:15,padding:"11px 0",borderBottom:"1px solid #edf1f2"},rowHighlight:{background:"#eff8d8",padding:"13px 12px",borderRadius:9,border:0,marginTop:7},heroNumber:{fontSize:34,fontWeight:850,color:"#0d2b2f",display:"grid",gap:5,marginBottom:12},
  progress:{display:"grid",gap:7,marginBottom:14},approval:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18},
};

const style=document.createElement("style");
style.textContent=`*{box-sizing:border-box}body{margin:0}h1{margin:3px 0 5px;font-size:29px}h2{margin:0;font-size:17px}p{margin:0;color:#6e8285;font-size:13px}.projectBadge span,.projectBadge small{font-size:10px;color:#91a9ab}.projectBadge b{font-size:13px}.kpi span{font-size:11px;color:#6c8184;text-transform:uppercase;letter-spacing:.5px}.kpi b{font-size:20px}.kpi small{font-size:11px;color:#849699}input,select{width:100%;border:1px solid #cad6d8;border-radius:8px;padding:9px;background:white;color:#17363a}input[type=checkbox]{width:16px}th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#708487;padding:10px;border-bottom:1px solid #dce5e6}td{padding:10px;border-bottom:1px solid #edf1f2;font-size:12px}.progress>div{display:flex;justify-content:space-between;font-size:12px}.progress i{height:7px;background:#edf2f2;border-radius:8px;overflow:hidden}.progress em{display:block;height:100%;background:#0d2b2f;border-radius:8px}.approval>div{padding:15px;border-radius:10px;background:#f3f7f7;display:grid;gap:6px}.approval span{font-size:10px;color:#718588}.approval b{font-size:19px}@media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)!important}.grid2{grid-template-columns:1fr!important}}@media(max-width:760px){.sidebar{position:static!important;width:100%!important}.shell{display:block!important}.main{margin:0!important;width:100%!important;padding:18px!important}.kpis{grid-template-columns:repeat(2,1fr)!important}.topbar{align-items:flex-start!important;flex-direction:column!important}}`;
if(typeof document!=="undefined"&&!document.getElementById("vimalux-enterprise-css")){style.id="vimalux-enterprise-css";document.head.appendChild(style);}
