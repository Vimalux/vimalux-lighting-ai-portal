import React, { useEffect, useState } from "react";
import { simulateScenario, scenarioRateBasis } from "./scenarioOptimizer.js";

const money = (v) => Number.isFinite(v) ? new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(v)+" €" : "—";
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const currentTerm = (x, fallback) => Math.max(1,Math.round(num(x) || fallback));

export function ScenarioRateNotice({ project, isAgent = true }) {
  const basis = scenarioRateBasis(project);
  return <>
    {!isAgent && <p className="muted" data-readonly-rates>Parametri finanziari in sola lettura: tasso finanziamento <strong>{basis.financing === null ? "—" : basis.financing + "%"}</strong> · tasso di sconto <strong>{basis.discount === null ? "—" : basis.discount + "%"}</strong>. I tassi sono gestiti esclusivamente da VIMALUX Admin.</p>}
    {!basis.valid && <p role="status">NPV non disponibile: presupposti finanziari da verificare da VIMALUX Admin. Cashflow indicativi, non approvati per offerte.</p>}
  </>;
}

export default function ScenarioOptimizerPanel({ project, isAgent = true }) {
  const [opened,setOpened] = useState(false);
  const [results,setResults] = useState([]);
  const [selected,setSelected] = useState("");
  const [error,setError] = useState("");
  const [running,setRunning] = useState(false);
  const [maxYears,setMaxYears] = useState(15);
  const enabled = project?.assumptions?.dealType === "finance";
  const cmsBase = currentTerm(project?.assumptions?.serviceAgreementPeriod,10);
  const adaptiveBase = currentTerm(project?.assumptions?.powerAidServicePeriod,cmsBase);
  const financeBase = currentTerm(project?.assumptions?.financingPeriod,10);
  const adaptiveEnabled = Boolean(project?.solution?.smartEnabled && project?.solution?.cmsEnabled && project?.solution?.powerAidEnabled);
  const code = s => [s.terms.financingYears,s.terms.cmsYears,s.terms.adaptiveYears].join("/");
  useEffect(()=>{setResults([]);setSelected("");setError("");},[project,maxYears]);
  const run=()=>{
    setRunning(true);setError("");
    try {
      if(maxYears<cmsBase || (adaptiveEnabled&&maxYears<adaptiveBase)) throw new Error("Il limite massimo è inferiore ai servizi attuali.");
      const snapshot=structuredClone(project);
      const found=[];
      for(let finance=5;finance<=maxYears;finance++){
        for(let cms=cmsBase;cms<=maxYears;cms++){
          const start=adaptiveEnabled?adaptiveBase:cms;
          for(let adaptive=start;adaptive<=(adaptiveEnabled?cms:start);adaptive++){
            found.push(simulateScenario(snapshot,{financingYears:finance,cmsYears:cms,adaptiveYears:adaptive,horizonYears:15}));
          }
        }
      }
      found.sort((a,b)=>Number(b.valid)-Number(a.valid)||(b.comparableNpv??-Infinity)-(a.comparableNpv??-Infinity));
      setResults(found);
      const preferred=found.find(x=>x.terms.financingYears===financeBase&&x.terms.cmsYears===cmsBase&&(!adaptiveEnabled||x.terms.adaptiveYears===adaptiveBase))||found[0];
      setSelected(preferred?code(preferred):"");
      if(!found.some(x=>x.valid))setError("Nessuna combinazione supera il vincolo di cashflow. Mostriamo gli scenari per revisione, non come raccomandazione.");
    }catch(e){setResults([]);setSelected("");setError(e.message||"Errore simulazione");}
    finally{setRunning(false);}
  };
  const selectedResult=results.find(s=>code(s)===selected);
  const benchmarks=[5,10,15].filter(x=>x<=maxYears).map(years=>
    results.find(s=>s.terms.financingYears===years&&s.terms.cmsYears===maxYears&&s.terms.adaptiveYears===(adaptiveEnabled?maxYears:maxYears))
  ).filter(Boolean);
  return <section className="card" data-scenario-optimizer="read-only">
    <h2>Ottimizza Business Case</h2>
    <p className="muted">Simulazioni indipendenti, senza salvataggio o modifica del Business Case, del CRM e dei prezzi.</p>
    {!enabled?<p className="muted">Disponibile per il finanziamento ESCO.</p>:<>
      <button type="button" onClick={()=>setOpened(v=>!v)}>{opened?"Chiudi simulatore":"Apri Scenario Optimizer"}</button>
      {opened&&<div style={{marginTop:12}}>
        <ScenarioRateNotice project={project} isAgent={isAgent} />
        <p className="muted">Business Case corrente: {financeBase} anni finanziamento / {cmsBase} anni CMS / {adaptiveEnabled?adaptiveBase+" anni Adaptive":"Adaptive non attivo"}.</p>
        <label>Durata massima (anni) <select value={maxYears} onChange={e=>setMaxYears(Number(e.target.value))}><option value="10">10</option><option value="12">12</option><option value="15">15</option></select></label>
        <p className="muted">I servizi non vengono accorciati automaticamente. NPV su 15 anni; confronto preliminare e non corretto per il rischio. Costi di garanzia, rinnovo e dati dopo la scadenza dei servizi richiedono verifica.</p>
        <button type="button" className="primary" disabled={running} onClick={run}>{running?"Calcolo…":"Simula scenari (senza salvare)"}</button>
        {error&&<p role="status" className="sync-error">{error}</p>}
        {!!results.length&&<>
          <h3>Confronto diretto — servizi {maxYears} anni</h3>
          <div className="table-scroll"><table><thead><tr><th>Fin./CMS/Adaptive</th><th>Beneficio anno 1</th><th>NPV 15 anni</th><th>Cashflow totale</th><th>Esito</th></tr></thead><tbody>{benchmarks.map(s=><tr key={code(s)}><td><button type="button" onClick={()=>setSelected(code(s))}>{adaptiveEnabled?code(s):s.terms.financingYears+"/"+s.terms.cmsYears+"/Non attivo"}</button></td><td>{money(s.firstYearBenefit)}</td><td>{money(s.comparableNpv)}</td><td>{money(s.cumulativeNetCashflow)}</td><td>{s.valid?"Cashflow OK":"Da rivedere"}</td></tr>)}</tbody></table></div>
          <h3>Tutte le combinazioni ammissibili (e da rivedere)</h3>
          <div className="table-scroll" style={{maxHeight:340,overflowY:"auto"}}><table><thead><tr><th>Fin.</th><th>CMS</th><th>Adaptive</th><th>Beneficio anno 1</th><th>NPV 15 anni</th><th>Stato</th></tr></thead><tbody>{results.map(s=><tr key={code(s)}><td><button type="button" onClick={()=>setSelected(code(s))}>{s.terms.financingYears}</button></td><td>{s.terms.cmsYears}</td><td>{adaptiveEnabled?s.terms.adaptiveYears:"Non attivo"}</td><td>{money(s.firstYearBenefit)}</td><td>{money(s.comparableNpv)}</td><td>{s.valid?"Cashflow OK":"Da rivedere"}</td></tr>)}</tbody></table></div>
          {selectedResult&&<div data-scenario-cashflow>
            <h3>Cashflow annuale — {adaptiveEnabled?selected:"Fin. "+selectedResult.terms.financingYears+" / CMS "+selectedResult.terms.cmsYears}</h3>
            <p className="muted">Rata finanziamento = 0 € dopo anno {selectedResult.terms.financingYears}. La durata CMS e Adaptive determina i servizi ancora attivi.</p>
            <div className="table-scroll" style={{maxHeight:420,overflowY:"auto"}}><table><thead><tr><th>Anno</th><th>Beneficio lordo</th><th>Finanziamento</th><th>Servizi</th><th>Netto annuale</th><th>Cumulato</th></tr></thead><tbody>{selectedResult.cashflowRows.map(row=><tr key={row.year}><td>{row.year}</td><td>{money(row.grossBenefit)}</td><td>{money(row.financePayment)}</td><td>{money(row.serviceOpex)}</td><td>{money(row.netCashFlow)}</td><td>{money(row.cumulative)}</td></tr>)}</tbody></table></div>
          </div>}
          <p className="muted">Nessuna proposta viene applicata automaticamente. La classifica non è ancora una raccomandazione di rischio approvata.</p>
        </>}
      </div>}
    </>}
  </section>;
}
