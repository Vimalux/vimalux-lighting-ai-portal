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
