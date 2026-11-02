import React, { useState } from "react";
import { simulateScenario } from "./scenarioOptimizer.js";

const fmt = (v) => Number.isFinite(v) ? new Intl.NumberFormat("it-IT",{maximumFractionDigits:0}).format(v)+" €" : "—";

export default function ScenarioOptimizerPanel({ project }) {
  const [opened,setOpened] = useState(false);
  const [results,setResults] = useState([]);
  const [error,setError] = useState("");
  const [running,setRunning] = useState(false);
  const [maxYears,setMaxYears] = useState(15);
  const enabled = project?.assumptions?.dealType === "finance";
  const currentCms = Math.max(1, Math.round(Number(project?.assumptions?.serviceAgreementPeriod) || 10));
  const currentAdaptive = Math.max(1, Math.round(Number(project?.assumptions?.powerAidServicePeriod) || currentCms));
  const currentFinance = Math.max(1, Math.round(Number(project?.assumptions?.financingPeriod) || 10));
  const run = () => {
    setRunning(true); setError("");
    try {
      const snapshot = structuredClone(project);
      if (maxYears < currentCms || (snapshot.solution?.powerAidEnabled && maxYears < currentAdaptive)) throw new Error("Durata massima inferiore ai servizi attivi: aumentare il limite.");
      const next = [];
      for (let finance=5; finance<=maxYears; finance++) {
        for (let cms=currentCms; cms<=maxYears; cms++) {
          // Adaptive Dimming remains available for the CMS term or a shorter period.
          const active = Boolean(snapshot.solution?.powerAidEnabled);
          const adaptiveTerms = active ? Array.from({length:Math.max(0,cms-currentAdaptive+1)},(_,i)=>currentAdaptive+i) : [1];
          for (const adaptive of adaptiveTerms) {
            const item = simulateScenario(snapshot,
              {financingYears:finance,cmsYears:cms,adaptiveYears:adaptive,horizonYears:15});
            if (item.valid) next.push(item);
          }
        }
      }
      next.sort((a,b)=>(b.comparableNpv??-Infinity)-(a.comparableNpv??-Infinity));
      setResults(next.slice(0,12));
      if (!next.length) setError("Nessuno scenario ammissibile con questi vincoli. Verificare durata massima e margine minimo.");
    } catch (err) {
      setResults([]); setError(err?.message || "Simulation failed");
    } finally {setRunning(false);}
  };
  return <section className="card" data-scenario-optimizer="read-only">
    <h2>Ottimizza Business Case</h2>
    <p className="muted">Simulazione read-only: non salva e non modifica prodotti, prezzi, progetti o CRM.</p>
    {!enabled ? <p className="muted">Disponibile inizialmente solo per la soluzione finanziaria.</p> : <>
      <button type="button" onClick={()=>setOpened(v=>!v)}>{opened?"Chiudi simulatore":"Apri Scenario Optimizer"}</button>
      {opened && <div style={{marginTop:12}}>
        <label>Durata massima (anni) <select value={maxYears} onChange={e=>setMaxYears(Number(e.target.value))}><option value="10">10</option><option value="12">12</option><option value="15">15</option></select></label>
        <p className="muted">Scenario di partenza: finanziamento {currentFinance} anni, CMS {currentCms} anni, Adaptive {currentAdaptive} anni. Le simulazioni non riducono la durata dei servizi già selezionata.</p>
        <p className="muted">NPV indicativo a 15 anni. Graduatoria provvisoria: rischio, garanzia e costi post-servizio devono essere validati prima di un'offerta.</p>
        <button type="button" className="primary" disabled={running} onClick={run}>{running?"Calcolo…":"Simula scenari (senza salvare)"}</button>
        {error && <p role="alert" className="sync-error">{error}</p>}
        {results.length>0 && <div className="table-scroll" style={{marginTop:12}}><table><thead><tr><th>Fin.</th><th>CMS</th><th>Adaptive</th><th>Beneficio anno 1</th><th>NPV comparabile 15 anni</th><th>Rischio</th></tr></thead><tbody>
          {results.map((item,i)=><tr key={i}><td>{item.terms.financingYears}</td><td>{item.terms.cmsYears}</td><td>{item.terms.adaptiveYears}</td><td>{fmt(item.firstYearBenefit)}</td><td>{fmt(item.comparableNpv)}</td><td>Da validare</td></tr>)}
        </tbody></table></div>}
      </div>}
    </>}
  </section>;
}
