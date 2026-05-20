import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const stages = [
  { id: "new", title: "Nye leads", probability: 0.15 },
  { id: "qualified", title: "Kvalificeret", probability: 0.35 },
  { id: "fullCase", title: "Full case", probability: 0.65 },
  { id: "closePlan", title: "Close plan", probability: 0.85 },
  { id: "won", title: "Vundet", probability: 1 },
];

const initialDeals = [
  {
    id: "d1",
    name: "LED retrofit - Bologna Nord",
    customer: "Comune di Bologna",
    owner: "Luciano",
    stage: "fullCase",
    tcv: 1250000,
    lamps: 3200,
    co2: 720,
    energySaving: 510000,
    closeDate: "2026-06-18",
    recommendation: "Go",
  },
  {
    id: "d2",
    name: "Smart CMS upgrade",
    customer: "Castel San Pietro",
    owner: "Luciano",
    stage: "closePlan",
    tcv: 890000,
    lamps: 2100,
    co2: 410,
    energySaving: 280000,
    closeDate: "2026-06-04",
    recommendation: "Go",
  },
  {
    id: "d3",
    name: "Industrial zone lighting",
    customer: "Aeroporto District",
    owner: "VIMALUX",
    stage: "qualified",
    tcv: 460000,
    lamps: 980,
    co2: 165,
    energySaving: 116000,
    closeDate: "2026-07-11",
    recommendation: "Review",
  },
  {
    id: "d4",
    name: "Solar street lamps",
    customer: "Rimini Smart City",
    owner: "Luciano",
    stage: "new",
    tcv: 620000,
    lamps: 1450,
    co2: 240,
    energySaving: 175000,
    closeDate: "2026-08-01",
    recommendation: "Go",
  },
  {
    id: "d5",
    name: "Municipal framework agreement",
    customer: "Unione Terre d'Acqua",
    owner: "VIMALUX",
    stage: "won",
    tcv: 2100000,
    lamps: 5400,
    co2: 980,
    energySaving: 690000,
    closeDate: "2026-05-28",
    recommendation: "Won",
  },
];

const stageById = Object.fromEntries(stages.map((stage) => [stage.id, stage]));

function money(value) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function compact(value) {
  return new Intl.NumberFormat("da-DK", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function weightedTcv(deal) {
  return deal.tcv * (stageById[deal.stage]?.probability || 0);
}
export default function App() {
  const [deals, setDeals] = useState(initialDeals);
  const [draggedDealId, setDraggedDealId] = useState(null);

  const totals = useMemo(() => {
    return deals.reduce(
      (sum, deal) => ({
        tcv: sum.tcv + deal.tcv,
        weighted: sum.weighted + weightedTcv(deal),
        lamps: sum.lamps + deal.lamps,
        co2: sum.co2 + deal.co2,
      }),
      { tcv: 0, weighted: 0, lamps: 0, co2: 0 }
    );
  }, [deals]);

  function moveDeal(stageId) {
    if (!draggedDealId) return;
    setDeals((items) =>
      items.map((deal) =>
        deal.id === draggedDealId ? { ...deal, stage: stageId } : deal
      )
    );
    setDraggedDealId(null);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.text("VIMALUX CRM Pipeline", 14, 18);
    autoTable(doc, {
      startY: 28,
      head: [["Customer", "Project", "Stage", "TCV", "Weighted"]],
      body: deals.map((deal) => [
        deal.customer,
        deal.name,
        stageById[deal.stage].title,
        money(deal.tcv),
        money(weightedTcv(deal)),
      ]),
    });
    doc.save("vimalux-crm-pipeline.pdf");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f8", fontFamily: "Arial, sans-serif", color: "#0f172a" }}>
      <div style={{ padding: 28, borderBottom: "1px solid #e2e8f0", background: "white", display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>VIMALUX CRM</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>Pipeline med TCV og weighted TCV</p>
        </div>
        <button onClick={exportPdf} style={{ padding: "12px 18px", borderRadius: 8, border: 0, background: "#0f172a", color: "white", fontWeight: 700 }}>
          Eksporter PDF
        </button>
      </div>

      <div style={{ padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          <Kpi label="Total TCV" value={money(totals.tcv)} />
          <Kpi label="Weighted TCV" value={money(totals.weighted)} />
          <Kpi label="Lamper" value={compact(totals.lamps)} />
          <Kpi label="CO2" value={`${compact(totals.co2)} ton`} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
          {stages.map((stage) => (
            <div
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveDeal(stage.id)}
              style={{ background: "#eef2f7", borderRadius: 8, padding: 12, minHeight: 420 }}
            >
              <h3 style={{ margin: "0 0 4px" }}>{stage.title}</h3>
              <p style={{ marginTop: 0, color: "#64748b" }}>{Math.round(stage.probability * 100)}% sandsynlighed</p>

              {deals.filter((deal) => deal.stage === stage.id).map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => setDraggedDealId(deal.id)}
                  style={{ background: "white", border: "1px solid #dbe3ee", borderRadius: 8, padding: 14, marginBottom: 10, cursor: "grab" }}
                >
                  <strong>{deal.customer}</strong>
                  <p style={{ color: "#334155" }}>{deal.name}</p>
                  <p style={{ fontWeight: 700 }}>{money(deal.tcv)}</p>
                  <p style={{ color: "#64748b" }}>Weighted: {money(weightedTcv(deal))}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={{ background: "white", border: "1px solid #dbe3ee", borderRadius: 8, padding: 18 }}>
      <p style={{ margin: 0, color: "#64748b" }}>{label}</p>
      <h2 style={{ margin: "8px 0 0" }}>{value}</h2>
    </div>
  );
}
