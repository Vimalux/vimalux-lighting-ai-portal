const STYLE_ID="v34-feasibility-commercial-inputs";

const fields=[
  ["Smart hardware cost / lamp","smartHardwareCostPerLamp",35],
  ["Smart hardware sales / lamp","smartHardwareSellPerLamp",48],
  ["Implementation cost / lamp","implementationCostPerLamp",4],
  ["Implementation sales / lamp","implementationSellPerLamp",6],
  ["CMS cost / lamp / year","cmsCostPerLampYear",3.42],
  ["CMS sales / lamp / year","cmsSellPerLampYear",4],
  ["Gateway quantity","gatewayQty",2],
  ["Gateway cost / unit","gatewayCost",400],
  ["Gateway sales / unit","gatewaySell",550],
  ["Gateway OPEX sales / year","gatewayOpex",6],
  ["Antenna quantity","antennaQty",2],
  ["Antenna cost / unit","antennaCost",80],
  ["Antenna sales / unit","antennaSell",104],
  ["Energy meter quantity","meterQty",2],
  ["Energy meter cost / unit","meterCost",300],
  ["Energy meter sales / unit","meterSell",365],
  ["PowerAiD internal cost / lamp / year","powerAidCostPerLampYear",0.25],
  ["PowerAiD share of extra saving %","powerAidPerformanceSharePct",10],
  ["Freight cost / lamp","freightCostPerLamp",11],
  ["Freight sales / lamp","freightSellPerLamp",11]
];

function parseNumber(value){
  const raw=String(value??"").trim().replace(/\s/g,"");
  if(!raw)return 0;
  return Number(raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw)||0;
}

function currentState(){
  try{
    const projects=JSON.parse(localStorage.getItem("vml-feas-projects")||"[]");
    const activeId=localStorage.getItem("vml-feas-active");
    const index=Math.max(0,projects.findIndex(p=>p.id===activeId));
    return {projects,index,project:projects[index]};
  }catch{return {projects:[],index:-1,project:null}}
}

function saveCommercial(key,value){
  const state=currentState();
  if(!state.project)return;
  const commercial={...(state.project.commercial||{}),[key]:value};
  fields.forEach(([,field,defaultValue])=>{if(commercial[field]===undefined)commercial[field]=defaultValue});
  state.projects[state.index]={...state.project,commercial};
  localStorage.setItem("vml-feas-projects",JSON.stringify(state.projects));
  location.reload();
}

function installStyles(doc=document){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement("style");
  style.id=STYLE_ID;
  style.textContent=`
    .v34-commercial-card{background:#fff;border-radius:18px;padding:26px;margin-top:20px;box-shadow:0 8px 24px rgba(13,43,47,.06)}
    .v34-commercial-card h2{margin:0 0 4px;font-size:24px;color:#102a2e}
    .v34-commercial-card p{margin:0 0 18px;color:#61777b}
    .v34-commercial-grid{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:14px}
    .v34-commercial-field{display:grid;gap:6px;font-weight:700;color:#243e42}
    .v34-commercial-field input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #cbd8da;border-radius:8px;font:inherit;font-weight:500}
    .v34-commercial-note{margin-top:18px;padding:12px 14px;border-radius:9px;background:#f3f7f8;color:#40575b;font-size:13px;line-height:1.45}
    @media(max-width:1100px){.v34-commercial-grid{grid-template-columns:repeat(2,minmax(180px,1fr))}}
    @media(max-width:700px){.v34-commercial-grid{grid-template-columns:1fr}}
  `;
  doc.head.appendChild(style);
}

function activeTabIsSolution(){
  return Array.from(document.querySelectorAll("aside button")).some(button=>button.textContent?.trim()==="Solution"&&getComputedStyle(button).backgroundColor==="rgb(201, 241, 90)");
}

function injectCommercialInputs(){
  if(!activeTabIsSolution())return;
  const main=document.querySelector("main");
  if(!main||main.querySelector(".v34-commercial-card"))return;
  const state=currentState();
  const commercial=state.project?.commercial||{};
  const card=document.createElement("section");
  card.className="v34-commercial-card";
  card.innerHTML=`<h2>Commercial pricing</h2><p>Internal cost and customer sales prices for the preliminary business case.</p><div class="v34-commercial-grid"></div><div class="v34-commercial-note"><b>Customer OPEX used in the business case:</b> CMS sales price + Gateway OPEX sales price + PowerAiD performance fee. Internal costs are stored separately for margin control and are not charged to the customer.</div>`;
  const grid=card.querySelector(".v34-commercial-grid");
  fields.forEach(([label,key,defaultValue])=>{
    const wrap=document.createElement("label");
    wrap.className="v34-commercial-field";
    const value=commercial[key]??defaultValue;
    wrap.innerHTML=`<span>${label}</span><input inputmode="decimal" value="${String(value).replace(".",",")}">`;
    const input=wrap.querySelector("input");
    input.addEventListener("keydown",event=>{if(event.key==="Enter")input.blur()});
    input.addEventListener("blur",()=>saveCommercial(key,parseNumber(input.value)));
    grid.appendChild(wrap);
  });
  main.appendChild(card);
}

function enhanceReportWindow(win){
  if(!win)return;
  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    try{
      const doc=win.document;
      if(doc?.body?.children?.length){
        const style=doc.createElement("style");
        style.textContent=`
          @media print{
            .head,.kpis,.go,.cols,.box,h2{break-inside:avoid;page-break-inside:avoid}
            table{break-inside:avoid;page-break-inside:avoid}
            tr,th,td{break-inside:avoid;page-break-inside:avoid}
            thead{display:table-header-group}
            h2{break-after:avoid;page-break-after:avoid}
            body{orphans:3;widows:3}
          }
        `;
        doc.head.appendChild(style);
        const heading=Array.from(doc.querySelectorAll("h2")).find(h=>h.textContent?.trim()==="Customer cash flow");
        const table=heading?.nextElementSibling;
        if(heading&&table?.tagName==="TABLE"){
          const section=doc.createElement("section");
          section.style.breakInside="avoid";
          section.style.pageBreakInside="avoid";
          heading.parentNode.insertBefore(section,heading);
          section.appendChild(heading);
          section.appendChild(table);
        }
        clearInterval(timer);
      }
    }catch{}
    if(tries>30||win.closed)clearInterval(timer);
  },100);
}

function patchWindowOpen(){
  if(window.__v34WindowOpenPatched)return;
  window.__v34WindowOpenPatched=true;
  const original=window.open.bind(window);
  window.open=(...args)=>{const win=original(...args);enhanceReportWindow(win);return win};
}

function apply(){
  installStyles();
  injectCommercialInputs();
  patchWindowOpen();
}

if(typeof document!=="undefined"){
  apply();
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.documentElement,{childList:true,subtree:true});
}
