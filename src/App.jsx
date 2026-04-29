import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* =====================================================
   VIMALUX LIGHTING AI PORTAL
   VERSION 26 – LIVE AUDIT ENGINE
   React single-file build
   No Tailwind dependency – inline CSS only

   Core principle:
   1) Bankable savings = documented / measurable cashflow
   2) Operational upside = optional, adjustable, not included in base case unless selected
   3) Strategic upside = qualitative, not monetised in base payback
===================================================== */

const STORAGE_KEY = "vimalux_app_v26_state";
const ADMIN_PASSWORD = "vimalux-admin";

const defaultProducts = [
  { id: "urban45", name: "VIMALUX Urban 45", watt: 45, lumen: 7650, sellPrice: 135, buyPrice: 95, install: 35 },
  { id: "street60", name: "VIMALUX Street 60", watt: 60, lumen: 10200, sellPrice: 155, buyPrice: 110, install: 35 },
  { id: "road90", name: "VIMALUX Road 90", watt: 90, lumen: 15300, sellPrice: 210, buyPrice: 150, install: 40 },
  { id: "highway120", name: "VIMALUX Highway 120", watt: 120, lumen: 20400, sellPrice: 285, buyPrice: 205, install: 45 },
];

const defaultAssumptions = {
  ledSavingPct: 55,
  energyPrice: 0.29,
  burningHours: 4200,
  maintenanceOldPerLamp: 25,
  maintenanceSavingPct: 50,
  smartNodeCost: 62,
  cmsFeePerLampYear: 6,
  powerAidFeePerLampYear: 3,
  cloSavingPct: 10,
  powerAidAdditionalSavingPct: 35,
  proposalYears: 10,
  financingMarginPct: 8,
  kgCo2PerKwh: 0.42,
  discountRatePct: 7,

  // Operational upside assumptions. These are separated from bankable base case.
  serviceEfficiencyPerLampYear: 5,
  fewerFailuresPerLampYear: 4,
  adminReductionPerLampYear: 2,
};

const emptyProject = {
  customerName: "",
  municipality: "",
  country: "Italy",
  contactPerson: "",
  proposalDate: new Date().toISOString().slice(0, 10),
  quantity: 500,
  existingWatt: 100,
  selectedProductId: "street60",
  includeInstallation: true,
  includeMaintenance: true,
  includeOperationalUpside: false,
  selectedOffer: "smart_poweraid",
  notes: "",
};

const emptyAuditSummary = {
  imported: false,
  fileName: "",
  rows: 0,
  quantity: 0,
  totalExistingWatt: 0,
  averageExistingWatt: 0,
  detectedWattColumn: "",
  detectedQuantityColumn: "",
  technologyMix: {},
  zoneMix: {},
};

const offers = [
  {
    id: "led",
    title: "LED Only",
    badge: "Base",
    smart: false,
    powerAid: false,
    positioning: "Lowest entry CAPEX / fastest basic upgrade",
    salesPosition: "Budget upgrade",
  },
  {
    id: "smart",
    title: "Smart CMS",
    badge: "Recommended",
    smart: true,
    powerAid: false,
    positioning: "Bankable CLO + maintenance + control layer",
    salesPosition: "Best structured case",
  },
  {
    id: "smart_poweraid",
    title: "Smart + PowerAiD",
    badge: "Premium",
    smart: true,
    powerAid: true,
    positioning: "Maximum measured energy optimization",
    salesPosition: "Maximum return",
  },
];

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = String(value).trim().replaceAll(" ", "");
  const normalized = raw.includes(",") ? raw.replaceAll(".", "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function inputNumber(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(".", ",");
}

function euro(value, decimals = 0) {
  return `€${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value))}`;
}

function num(value, decimals = 0) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toNumber(value));
}

function pct(value) {
  return `${num(value, 1)}%`;
}

function safeProduct(products, selectedProductId) {
  return products.find((product) => product.id === selectedProductId) || products[0] || defaultProducts[0];
}

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers, candidates) {
  const normalized = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  for (const candidate of candidates) {
    const c = normalizeHeader(candidate);
    const exact = normalized.find((h) => h.normalized === c);
    if (exact) return exact.original;
  }
  for (const candidate of candidates) {
    const c = normalizeHeader(candidate);
    const partial = normalized.find((h) => h.normalized.includes(c) || c.includes(h.normalized));
    if (partial) return partial.original;
  }
  return "";
}

function countMix(rows, column) {
  if (!column) return {};
  const mix = {};
  rows.forEach((row) => {
    const key = String(row[column] || "Unknown").trim() || "Unknown";
    mix[key] = (mix[key] || 0) + 1;
  });
  return mix;
}

function parseAuditWorkbook(workbook, fileName = "") {
  // Scan all sheets and choose the first sheet with valid audit data before row 29.
  // This is needed because customer templates may have an ITA sheet first and the filled EN sheet second.
  let best = emptyAuditSummary;
  workbook.SheetNames.forEach((sheetName) => {
    const candidate = parseAuditSheet(workbook.Sheets[sheetName], `${fileName} / ${sheetName}`);
    if (candidate.imported && candidate.quantity > 0 && candidate.averageExistingWatt > 0) {
      if (!best.imported || candidate.quantity > best.quantity) best = candidate;
    }
  });
  return best;
}

function parseAuditSheet(sheet, fileName = "") {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const limitedRaw = raw.slice(0, 29); // Audit import ignores everything after row 29.

  const candidateHeaders = [
    "number of luminares",
    "number of luminaires",
    "number of luminaries",
    "numero di apparecchi",
    "quantity",
    "qty",
    "power consumption per luminare",
    "power consumption per luminaire",
    "consumo di energia per apparecchio",
    "watt",
    "wattage",
    "potenza",
  ];

  let headerIndex = -1;
  let bestScore = 0;

  limitedRaw.forEach((row, index) => {
    const joined = row.map((cell) => normalizeHeader(cell)).join(" ");
    const score = candidateHeaders.reduce((sum, candidate) => sum + (joined.includes(normalizeHeader(candidate)) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  if (headerIndex < 0 || bestScore < 2) return emptyAuditSummary;

  const headers = limitedRaw[headerIndex].map((h, i) => String(h || `Column ${i + 1}`).trim());
  const dataRows = limitedRaw
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  const rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? "";
    });
    return obj;
  });

  return parseAuditRows(rows, fileName);
}

function detectAuditColumns(headers) {
  const normalized = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));

  const qtyHit = normalized.find((h) =>
    h.normalized.includes("numberofluminares") ||
    h.normalized.includes("numberofluminaires") ||
    h.normalized.includes("numberofluminaries") ||
    h.normalized.includes("numerodiapparecchi") ||
    h.normalized.includes("quantita") ||
    h.normalized === "qty" ||
    h.normalized === "quantity"
  );

  const wattHit = normalized.find((h) => {
    const n = h.normalized;
    const looksLikeWatt =
      n.includes("powerconsumption") ||
      n.includes("consumodienergia") ||
      n.includes("potenza") ||
      n.includes("wattage") ||
      n.includes("watt");
    const isHours = n.includes("hour") || n.includes("ore") || n.includes("burning");
    const isLumen = n.includes("lumen") || n.includes("lm") || n.includes("flusso");
    return looksLikeWatt && !isHours && !isLumen;
  });

  const techHit = normalized.find((h) =>
    h.normalized.includes("currentluminaretype") ||
    h.normalized.includes("currentluminairetype") ||
    h.normalized.includes("tipodiluminarecorrente") ||
    h.normalized.includes("tecnologia") ||
    h.normalized.includes("technology") ||
    h.normalized.includes("lamptype")
  );

  const zoneHit = normalized.find((h) =>
    h.normalized.includes("location") ||
    h.normalized.includes("posizione") ||
    h.normalized.includes("groupnaming") ||
    h.normalized.includes("zone") ||
    h.normalized.includes("street") ||
    h.normalized.includes("via")
  );

  return {
    qtyCol: qtyHit ? qtyHit.original : "",
    wattCol: wattHit ? wattHit.original : "",
    techCol: techHit ? techHit.original : "",
    zoneCol: zoneHit ? zoneHit.original : "",
  };
}

function parseAuditRows(rows, fileName = "") {
  if (!rows || !rows.length) return emptyAuditSummary;
  const headers = Object.keys(rows[0] || {});
  const detected = detectAuditColumns(headers);
  const wattCol = detected.wattCol || findColumn(headers, ["existing wattage", "existing watt", "wattage", "watt", "power", "potenza", "w", "kw", "watt esistente", "potenza esistente", "power consumption per luminare", "power consumption per luminaire"]);
  const qtyCol = detected.qtyCol || findColumn(headers, ["quantity", "qty", "count", "number", "numero", "quantita", "quantità", "n", "number of luminares", "number of luminaires", "number of luminaries"]);
  const techCol = detected.techCol || findColumn(headers, ["technology", "lamp type", "type", "tecnologia", "tipologia", "source", "sorgente", "current luminare type", "current luminaire type"]);
  const zoneCol = detected.zoneCol || findColumn(headers, ["zone", "area", "street", "road", "via", "strada", "quartiere", "location", "group naming"]);

  let totalQuantity = 0;
  let totalWatt = 0;
  let validRows = 0;

  rows.forEach((row) => {
    const qtyRaw = qtyCol ? row[qtyCol] : 1;
    const wattRaw = wattCol ? row[wattCol] : 0;
    const qty = Math.max(0, toNumber(qtyRaw, 1)) || 1;
    let watt = toNumber(wattRaw, 0);
    if (normalizeHeader(wattCol).includes("kw") && watt < 10) watt *= 1000;
    if (watt > 0 && qty > 0) {
      totalQuantity += qty;
      totalWatt += watt * qty;
      validRows += 1;
    }
  });

  const averageExistingWatt = totalQuantity > 0 ? totalWatt / totalQuantity : 0;
  if (!wattCol || !qtyCol || totalQuantity <= 0 || averageExistingWatt <= 0) return emptyAuditSummary;

  return {
    imported: true,
    fileName,
    rows: validRows,
    quantity: Math.round(totalQuantity),
    totalExistingWatt: totalWatt,
    averageExistingWatt,
    detectedWattColumn: wattCol,
    detectedQuantityColumn: qtyCol,
    technologyMix: countMix(rows, techCol),
    zoneMix: countMix(rows, zoneCol),
  };
}

function parseProductRows(rows) {
  if (!rows || !rows.length) return [];
  const headers = Object.keys(rows[0] || {});
  const nameCol = findColumn(headers, ["name", "product", "model", "nome", "prodotto", "luminaire"]);
  const wattCol = findColumn(headers, ["watt", "w", "power", "potenza"]);
  const lumenCol = findColumn(headers, ["lumen", "lm", "flux", "flusso"]);
  const sellCol = findColumn(headers, ["sell", "sell price", "price", "sale", "prezzo vendita", "selling price"]);
  const buyCol = findColumn(headers, ["buy", "buy price", "cost", "purchase", "prezzo acquisto"]);
  const installCol = findColumn(headers, ["install", "installation", "install price", "montaggio", "posa"]);

  return rows
    .map((row, index) => ({
      id: `import_${Date.now()}_${index}`,
      name: String(row[nameCol] || `Imported Product ${index + 1}`).trim(),
      watt: toNumber(row[wattCol], 0),
      lumen: toNumber(row[lumenCol], 0),
      sellPrice: toNumber(row[sellCol], 0),
      buyPrice: toNumber(row[buyCol], 0),
      install: toNumber(row[installCol], 0),
    }))
    .filter((p) => p.name && toNumber(p.watt) > 0);
}

function npv(ratePct, annualCash, years, initialCapex) {
  const rate = toNumber(ratePct) / 100;
  let value = -initialCapex;
  for (let y = 1; y <= years; y += 1) {
    value += annualCash / Math.pow(1 + rate, y);
  }
  return value;
}

function simpleIrr(annualCash, years, initialCapex) {
  if (initialCapex <= 0 || annualCash <= 0) return null;
  let low = -0.9;
  let high = 1.5;
  for (let i = 0; i < 90; i += 1) {
    const mid = (low + high) / 2;
    let value = -initialCapex;
    for (let y = 1; y <= years; y += 1) {
      value += annualCash / Math.pow(1 + mid, y);
    }
    if (value > 0) low = mid;
    else high = mid;
  }
  return ((low + high) / 2) * 100;
}

function calculateOffer(project, assumptions, products, offerId) {
  const offer = offers.find((item) => item.id === offerId) || offers[0];
  const product = safeProduct(products, project.selectedProductId);

  const quantity = Math.max(0, toNumber(project.quantity));
  const oldWatt = Math.max(0, toNumber(project.existingWatt));
  const hours = Math.max(0, toNumber(assumptions.burningHours));
  const energyPrice = Math.max(0, toNumber(assumptions.energyPrice));
  const years = Math.max(1, toNumber(assumptions.proposalYears, 10));

  const ledSavingPct = Math.max(0, Math.min(100, toNumber(assumptions.ledSavingPct))) / 100;
  const cloSavingPct = offer.smart ? Math.max(0, Math.min(100, toNumber(assumptions.cloSavingPct))) / 100 : 0;
  const powerAidPct = offer.powerAid ? Math.max(0, Math.min(100, toNumber(assumptions.powerAidAdditionalSavingPct))) / 100 : 0;

  const oldKwh = (quantity * oldWatt * hours) / 1000;
  const postLedKwh = oldKwh * (1 - ledSavingPct);
  const postCloKwh = offer.smart ? postLedKwh * (1 - cloSavingPct) : postLedKwh;
  const finalKwh = offer.powerAid ? postCloKwh * (1 - powerAidPct) : postCloKwh;

  const oldEnergyCost = oldKwh * energyPrice;
  const postLedEnergyCost = postLedKwh * energyPrice;
  const postCloEnergyCost = postCloKwh * energyPrice;
  const newEnergyCost = finalKwh * energyPrice;

  const ledSaving = Math.max(0, oldEnergyCost - postLedEnergyCost);
  const cloSaving = offer.smart ? Math.max(0, postLedEnergyCost - postCloEnergyCost) : 0;
  const powerAidSaving = offer.powerAid ? Math.max(0, postCloEnergyCost - newEnergyCost) : 0;

  const maintenanceSaving = project.includeMaintenance && offer.smart
    ? quantity * toNumber(assumptions.maintenanceOldPerLamp) * (toNumber(assumptions.maintenanceSavingPct) / 100)
    : 0;

  // Bankable base case: only directly defendable / measurable values.
  const guaranteedSaving = ledSaving + cloSaving + powerAidSaving + maintenanceSaving;

  // Operational upside: visible and optionally included, but separated.
  const serviceEfficiencySaving = offer.smart ? quantity * toNumber(assumptions.serviceEfficiencyPerLampYear) : 0;
  const fewerFailuresSaving = offer.smart ? quantity * toNumber(assumptions.fewerFailuresPerLampYear) : 0;
  const adminReductionSaving = offer.smart ? quantity * toNumber(assumptions.adminReductionPerLampYear) : 0;
  const operationalUpside = serviceEfficiencySaving + fewerFailuresSaving + adminReductionSaving;
  const includedOperationalUpside = project.includeOperationalUpside ? operationalUpside : 0;

  const luminaireCapex = quantity * toNumber(product.sellPrice);
  const installationCapex = project.includeInstallation ? quantity * toNumber(product.install) : 0;
  const smartCapex = offer.smart ? quantity * toNumber(assumptions.smartNodeCost) : 0;
  const totalCapex = luminaireCapex + installationCapex + smartCapex;

  const cmsOpex = offer.smart ? quantity * toNumber(assumptions.cmsFeePerLampYear) : 0;
  const powerAidOpex = offer.powerAid ? quantity * toNumber(assumptions.powerAidFeePerLampYear) : 0;
  const annualNewOpex = cmsOpex + powerAidOpex;

  const annualBaseNetSaving = guaranteedSaving - annualNewOpex;
  const annualUpsideNetSaving = annualBaseNetSaving + operationalUpside;
  const annualSelectedNetSaving = annualBaseNetSaving + includedOperationalUpside;

  const basePaybackYears = annualBaseNetSaving > 0 ? totalCapex / annualBaseNetSaving : null;
  const selectedPaybackYears = annualSelectedNetSaving > 0 ? totalCapex / annualSelectedNetSaving : null;

  const financingMargin = totalCapex * (toNumber(assumptions.financingMarginPct) / 100);
  const investorValue = totalCapex + financingMargin;
  const laasAnnual = investorValue / years + annualNewOpex;
  const laasMonthly = laasAnnual / 12;

  const baseTenYearNetSavings = annualBaseNetSaving * years;
  const upsideTenYearNetSavings = annualUpsideNetSaving * years;
  const selectedTenYearNetSavings = annualSelectedNetSaving * years;

  const baseNpv = npv(toNumber(assumptions.discountRatePct), annualBaseNetSaving, years, totalCapex);
  const selectedNpv = npv(toNumber(assumptions.discountRatePct), annualSelectedNetSaving, years, totalCapex);
  const baseIrr = simpleIrr(annualBaseNetSaving, years, totalCapex);
  const selectedIrr = simpleIrr(annualSelectedNetSaving, years, totalCapex);

  const co2SavedTons = ((oldKwh - finalKwh) * toNumber(assumptions.kgCo2PerKwh)) / 1000;
  const energyReductionPct = oldKwh > 0 ? ((oldKwh - finalKwh) / oldKwh) * 100 : 0;

  return {
    offer,
    product,
    quantity,
    oldWatt,
    newWatt: toNumber(product.watt),
    years,
    oldKwh,
    postLedKwh,
    postCloKwh,
    finalKwh,
    oldEnergyCost,
    newEnergyCost,
    ledSaving,
    cloSaving,
    powerAidSaving,
    maintenanceSaving,
    guaranteedSaving,
    serviceEfficiencySaving,
    fewerFailuresSaving,
    adminReductionSaving,
    operationalUpside,
    includedOperationalUpside,
    luminaireCapex,
    installationCapex,
    smartCapex,
    totalCapex,
    cmsOpex,
    powerAidOpex,
    annualNewOpex,
    annualBaseNetSaving,
    annualUpsideNetSaving,
    annualSelectedNetSaving,
    basePaybackYears,
    selectedPaybackYears,
    financingMargin,
    investorValue,
    laasAnnual,
    laasMonthly,
    baseTenYearNetSavings,
    upsideTenYearNetSavings,
    selectedTenYearNetSavings,
    baseNpv,
    selectedNpv,
    baseIrr,
    selectedIrr,
    co2SavedTons,
    energyReductionPct,
  };
}

function buildRows(calc, useUpside) {
  const annual = useUpside ? calc.annualSelectedNetSaving : calc.annualBaseNetSaving;
  return Array.from({ length: calc.years }, (_, i) => {
    const year = i + 1;
    return {
      year,
      guaranteedSaving: calc.guaranteedSaving,
      operationalUpside: calc.operationalUpside,
      includedOperationalUpside: useUpside ? calc.operationalUpside : 0,
      newOpex: calc.annualNewOpex,
      netSaving: annual,
      cumulativeNetSaving: annual * year,
    };
  });
}

export default function VimaluxLightingPortalV26() {
  const [products, setProducts] = useState(defaultProducts);
  const [assumptions, setAssumptions] = useState(defaultAssumptions);
  const [project, setProject] = useState(emptyProject);
  const [auditSummary, setAuditSummary] = useState(emptyAuditSummary);
  const [adminMode, setAdminMode] = useState(false);
  const [viewMode, setViewMode] = useState("customer");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.products) setProducts(parsed.products);
      if (parsed.assumptions) setAssumptions({ ...defaultAssumptions, ...parsed.assumptions });
      if (parsed.project) setProject({ ...emptyProject, ...parsed.project });
      if (parsed.auditSummary) setAuditSummary({ ...emptyAuditSummary, ...parsed.auditSummary });
      if (parsed.adminMode) setAdminMode(parsed.adminMode);
      if (parsed.viewMode) setViewMode(parsed.viewMode);
    } catch (error) {
      console.warn("Could not load saved state", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, assumptions, project, auditSummary, adminMode, viewMode }));
  }, [products, assumptions, project, auditSummary, adminMode, viewMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedCalc = useMemo(
    () => calculateOffer(project, assumptions, products, project.selectedOffer),
    [project, assumptions, products]
  );

  const comparison = useMemo(
    () => offers.map((offer) => calculateOffer(project, assumptions, products, offer.id)),
    [project, assumptions, products]
  );

  const rows = useMemo(() => buildRows(selectedCalc, project.includeOperationalUpside), [selectedCalc, project.includeOperationalUpside]);
  const maxCumulative = Math.max(...rows.map((row) => row.cumulativeNetSaving), 1);
  const showAdminPanel = adminMode && viewMode === "admin";

  function updateProject(field, value) {
    setProject((prev) => ({ ...prev, [field]: value }));
  }

  function updateAssumption(field, value) {
    setAssumptions((prev) => ({ ...prev, [field]: value }));
  }

  function updateProduct(id, field, value) {
    setProducts((prev) => prev.map((product) => (product.id === id ? { ...product, [field]: value } : product)));
  }

  function handleAuditImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const summary = parseAuditWorkbook(workbook, file.name);
        if (!summary.imported || !summary.quantity || !summary.averageExistingWatt) {
          setToast("Audit import failed: wattage/quantity columns not detected");
          return;
        }
        setAuditSummary(summary);
        setProject((prev) => ({
          ...prev,
          quantity: summary.quantity,
          existingWatt: Math.round(summary.averageExistingWatt * 10) / 10,
        }));
        setToast(`Audit imported: ${summary.quantity} luminaires`);
      } catch (error) {
        console.error(error);
        setToast("Audit import failed");
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }

  function handleProductCatalogueImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const importedProducts = parseProductRows(rows);
        if (!importedProducts.length) {
          setToast("Product import failed: no valid products found");
          return;
        }
        setProducts(importedProducts);
        setProject((prev) => ({ ...prev, selectedProductId: importedProducts[0].id }));
        setToast(`Product catalogue imported: ${importedProducts.length} products`);
      } catch (error) {
        console.error(error);
        setToast("Product catalogue import failed");
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  }

  function unlockAdmin() {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminMode(true);
      setViewMode("admin");
      setShowLogin(false);
      setAdminPassword("");
      setToast("Admin unlocked");
    } else {
      setToast("Wrong admin password");
    }
  }

  function logoutAdmin() {
    setAdminMode(false);
    setViewMode("customer");
    setShowLogin(false);
    setToast("Back to customer mode");
  }

  function addProduct() {
    const id = `custom_${Date.now()}`;
    setProducts((prev) => [
      ...prev,
      { id, name: "Custom Luminaire", watt: 60, lumen: 10000, sellPrice: 150, buyPrice: 110, install: 35 },
    ]);
    updateProject("selectedProductId", id);
  }

  function resetAll() {
    setProducts(defaultProducts);
    setAssumptions(defaultAssumptions);
    setProject(emptyProject);
    setAuditSummary(emptyAuditSummary);
    setAdminMode(false);
    setViewMode("customer");
    localStorage.removeItem(STORAGE_KEY);
    setToast("Dashboard reset");
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        comparison.map((calc) => ({
          Offer: calc.offer.title,
          Sales_Position: calc.offer.salesPosition,
          Total_CAPEX: calc.totalCapex,
          Guaranteed_Saving: calc.guaranteedSaving,
          Annual_Base_Net_Saving: calc.annualBaseNetSaving,
          Operational_Upside: calc.operationalUpside,
          Annual_Upside_Net_Saving: calc.annualUpsideNetSaving,
          Base_Payback_Years: calc.basePaybackYears,
          Upside_Payback_Years: calc.annualUpsideNetSaving > 0 ? calc.totalCapex / calc.annualUpsideNetSaving : null,
          Base_10Y_Net: calc.baseTenYearNetSavings,
          Upside_10Y_Net: calc.upsideTenYearNetSavings,
          Base_NPV: calc.baseNpv,
          Base_IRR: calc.baseIrr,
          LaaS_Month: calc.laasMonthly,
          Energy_Reduction_Pct: calc.energyReductionPct,
          CO2_Tons_Year: calc.co2SavedTons,
        }))
      ),
      "Offer Comparison"
    );

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Selected Cashflow");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([auditSummary]), "Audit Summary");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([{ ...project, product: selectedCalc.product.name, selectedOffer: selectedCalc.offer.title }]),
      "Project"
    );
    if (adminMode) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products), "Products");
    if (adminMode) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([assumptions]), "Assumptions");

    XLSX.writeFile(wb, `VIMALUX_${project.municipality || "proposal"}_V25.xlsx`);
  }

  function pdfHeader(doc, title, subtitle) {
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(subtitle, 14, 22);
  }

  function footer(doc, page) {
    doc.setFontSize(8);
    doc.setTextColor(110, 118, 129);
    doc.text("VIMALUX – Smart Lighting / Smart City Infrastructure", 14, 287);
    doc.text(`Page ${page}`, 190, 287, { align: "right" });
  }

  function exportPdfProposal() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const municipality = project.municipality || "Municipality";
    const customer = project.customerName || "Customer";

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("VIMALUX", 14, 28);
    doc.setFontSize(20);
    doc.text("Bank-Grade Smart Lighting Proposal", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Prepared for: ${customer}`, 14, 68);
    doc.text(`Municipality: ${municipality}`, 14, 76);
    doc.text(`Selected package: ${selectedCalc.offer.title}`, 14, 84);
    if (auditSummary.imported) doc.text(`Audit source: ${auditSummary.fileName}`, 14, 100);
    doc.text(`Date: ${project.proposalDate}`, 14, auditSummary.imported ? 108 : 92);
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.2);
    doc.line(14, auditSummary.imported ? 120 : 106, 196, auditSummary.imported ? 120 : 106);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Base Case Summary", 14, auditSummary.imported ? 142 : 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Guaranteed annual saving: ${euro(selectedCalc.guaranteedSaving)}`, 14, auditSummary.imported ? 158 : 146);
    doc.text(`Annual base net cashflow: ${euro(selectedCalc.annualBaseNetSaving)}`, 14, auditSummary.imported ? 168 : 156);
    doc.text(`Base payback: ${selectedCalc.basePaybackYears ? `${num(selectedCalc.basePaybackYears, 1)} years` : "N/A"}`, 14, auditSummary.imported ? 178 : 166);
    doc.text(`Base 10-year net savings: ${euro(selectedCalc.baseTenYearNetSavings)}`, 14, auditSummary.imported ? 188 : 176);
    doc.text(`Base NPV: ${euro(selectedCalc.baseNpv)} | Base IRR: ${selectedCalc.baseIrr ? pct(selectedCalc.baseIrr) : "N/A"}`, 14, auditSummary.imported ? 198 : 186);
    doc.text(`Operational upside, not included in base case: ${euro(selectedCalc.operationalUpside)} / year`, 14, auditSummary.imported ? 212 : 200);
    footer(doc, 1);

    doc.addPage();
    pdfHeader(doc, "1. Audit Baseline", "Imported customer audit sheet baseline");
    autoTable(doc, {
      startY: 42,
      head: [["Audit field", "Value"]],
      body: [
        ["Audit source", auditSummary.imported ? auditSummary.fileName : "Manual input"],
        ["Rows read", auditSummary.imported ? num(auditSummary.rows) : "N/A"],
        ["Total luminaires", num(selectedCalc.quantity)],
        ["Average existing wattage", `${num(project.existingWatt, 1)} W`],
        ["Detected watt column", auditSummary.detectedWattColumn || "Manual"],
        ["Detected quantity column", auditSummary.detectedQuantityColumn || "Manual"],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 },
    });
    footer(doc, 7);

    doc.addPage();
    pdfHeader(doc, "2. Offer Comparison", "Bankable base case separated from operational upside");
    autoTable(doc, {
      startY: 42,
      head: [["Offer", "Position", "Base Net", "Base Payback", "Base 10Y", "Base NPV", "Upside / yr"]],
      body: comparison.map((calc) => [
        calc.offer.title,
        calc.offer.salesPosition,
        euro(calc.annualBaseNetSaving),
        calc.basePaybackYears ? `${num(calc.basePaybackYears, 1)} yrs` : "N/A",
        euro(calc.baseTenYearNetSavings),
        euro(calc.baseNpv),
        euro(calc.operationalUpside),
      ]),
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 7.5 },
    });
    footer(doc, 2);

    doc.addPage();
    pdfHeader(doc, "3. Guaranteed Value Stack", "Only measurable and bankable savings included in base case");
    autoTable(doc, {
      startY: 42,
      head: [["Layer", "Evidence basis", "Annual value"]],
      body: [
        ["LED upgrade", `${num(assumptions.ledSavingPct)}% saving vs old baseline`, euro(selectedCalc.ledSaving)],
        ["CLO", selectedCalc.offer.smart ? `${num(assumptions.cloSavingPct)}% on post-LED consumption` : "Not included", euro(selectedCalc.cloSaving)],
        ["Maintenance", selectedCalc.offer.smart ? `${num(assumptions.maintenanceSavingPct)}% reduction assumption` : "Requires Smart CMS", euro(selectedCalc.maintenanceSaving)],
        ["PowerAiD", selectedCalc.offer.powerAid ? `${num(assumptions.powerAidAdditionalSavingPct)}% on post-LED+CLO load` : "Not included", euro(selectedCalc.powerAidSaving)],
        ["Recurring OPEX", "CMS / PowerAiD annual fees", `-${euro(selectedCalc.annualNewOpex)}`],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 },
    });
    footer(doc, 3);

    doc.addPage();
    pdfHeader(doc, "4. Operational Upside", "Not included in base case unless explicitly selected");
    autoTable(doc, {
      startY: 42,
      head: [["Layer", "Evidence to collect", "Indicative value"]],
      body: [
        ["Service efficiency", "Remote diagnostics, reduced manual inspection", euro(selectedCalc.serviceEfficiencySaving)],
        ["Fewer failures", "Fault logs, outage duration, replacement history", euro(selectedCalc.fewerFailuresSaving)],
        ["Admin reduction", "Automated reporting, reduced internal processing", euro(selectedCalc.adminReductionSaving)],
        ["Total operational upside", "Separate upside case", euro(selectedCalc.operationalUpside)],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8.5 },
    });
    footer(doc, 4);

    doc.addPage();
    pdfHeader(doc, "5. Commercial Options", "Direct purchase, LaaS or financed structure");
    autoTable(doc, {
      startY: 42,
      head: [["Commercial metric", "Value"]],
      body: [
        ["Total CAPEX", euro(selectedCalc.totalCapex)],
        ["Investor value incl. margin", euro(selectedCalc.investorValue)],
        ["Indicative LaaS / month", euro(selectedCalc.laasMonthly)],
        ["Base annual net saving", euro(selectedCalc.annualBaseNetSaving)],
        ["Base 10-year net saving", euro(selectedCalc.baseTenYearNetSavings)],
        ["Base NPV", euro(selectedCalc.baseNpv)],
        ["Base IRR", selectedCalc.baseIrr ? pct(selectedCalc.baseIrr) : "N/A"],
        ["CO2 reduction / year", `${num(selectedCalc.co2SavedTons, 1)} t`],
      ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
    });
    footer(doc, 5);

    doc.addPage();
    pdfHeader(doc, "6. Evidence & Risk Controls", "How to make the case credit-ready");
    const bullets = [
      "LED savings: document existing wattage, new wattage, burn hours and energy tariff.",
      "CLO: document dimming profiles, CMS logs and post-LED consumption baseline.",
      "Maintenance: document historical maintenance spend, service tickets and truck rolls.",
      "PowerAiD: document traffic logic, measured dimming events and runtime reduction.",
      "Operational upside: keep separate until backed by service KPIs and historical data.",
      "Strategic upside: ESG reporting, financing profile and smart city optionality should remain qualitative unless independently valued.",
    ];
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    bullets.forEach((bullet, i) => doc.text(`• ${bullet}`, 18, 48 + i * 13, { maxWidth: 174 }));
    doc.setFontSize(8);
    doc.text(
      "Non-binding indication: figures are indicative and subject to technical validation, financing approval, final product selection, legal structure, credit assessment and site verification.",
      14,
      260,
      { maxWidth: 182 }
    );
    footer(doc, 6);

    doc.save(`VIMALUX_${municipality}_V26_audit_proposal.pdf`);
  }

  const selectedAnnual = project.includeOperationalUpside ? selectedCalc.annualSelectedNetSaving : selectedCalc.annualBaseNetSaving;
  const selectedPayback = project.includeOperationalUpside ? selectedCalc.selectedPaybackYears : selectedCalc.basePaybackYears;
  const selectedTenYear = project.includeOperationalUpside ? selectedCalc.selectedTenYearNetSavings : selectedCalc.baseTenYearNetSavings;
  const selectedNpv = project.includeOperationalUpside ? selectedCalc.selectedNpv : selectedCalc.baseNpv;
  const selectedIrr = project.includeOperationalUpside ? selectedCalc.selectedIrr : selectedCalc.baseIrr;

  return (
    <div style={styles.page}>
      {toast && <div style={(toast.toLowerCase().includes("wrong") || toast.toLowerCase().includes("failed")) ? styles.toastError : styles.toast}>{toast}</div>}
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <button style={styles.logoMark} onClick={() => setViewMode("customer")}>V</button>
            <div>
              <h1 style={styles.title}>VIMALUX Lighting AI Portal</h1>
              <p style={styles.subtitle}>Version 26 – Live Audit Engine</p>
            </div>
          </div>
          <div style={styles.headerActions}>
            <button onClick={() => setViewMode("customer")} style={viewMode === "customer" ? styles.primaryButton : styles.secondaryButton}>Customer</button>
            {!adminMode && <button onClick={() => setShowLogin((v) => !v)} style={styles.secondaryButton}>Admin Login</button>}
            {adminMode && <button onClick={() => setViewMode("admin")} style={viewMode === "admin" ? styles.primaryButton : styles.secondaryButton}>Admin</button>}
            {adminMode && <button onClick={logoutAdmin} style={styles.ghostButton}>Logout</button>}
            <button onClick={exportPdfProposal} style={styles.primaryButton}>PDF Proposal</button>
            <button onClick={exportExcel} style={styles.secondaryButton}>Excel</button>
            <button onClick={resetAll} style={styles.ghostButton}>Reset</button>
          </div>
        </header>

        {showLogin && !adminMode && (
          <section style={styles.loginBar}>
            <input
              style={styles.loginInput}
              type="password"
              placeholder="Admin password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") unlockAdmin(); }}
            />
            <button onClick={unlockAdmin} style={styles.primaryButton}>Unlock</button>
          </section>
        )}

        <section style={styles.offerGrid}>
          {comparison.map((calc) => (
            <OfferCard
              key={calc.offer.id}
              calc={calc}
              selected={project.selectedOffer === calc.offer.id}
              onSelect={() => updateProject("selectedOffer", calc.offer.id)}
            />
          ))}
        </section>

        <section style={styles.auditBar}>
          <div>
            <strong>Audit import:</strong> upload customer Excel/CSV to replace manual quantity and existing wattage.
            {auditSummary.imported && <div style={styles.auditMini}>Imported {auditSummary.fileName}: {num(auditSummary.quantity)} luminaires · avg {num(auditSummary.averageExistingWatt, 1)} W</div>}
          </div>
          <label style={styles.importButton}>Import Audit Sheet<input type="file" accept=".xlsx,.xls,.csv" onChange={handleAuditImport} style={{ display: "none" }} /></label>
        </section>

        <section style={styles.caseToggleRow}>
          <div>
            <strong>Base case mode:</strong> guaranteed savings only. Operational upside is shown separately.
          </div>
          <Toggle label="Include operational upside in KPIs" checked={project.includeOperationalUpside} onChange={(value) => updateProject("includeOperationalUpside", value)} />
        </section>

        <section style={styles.kpiGrid}>
          <Kpi label="Guaranteed Saving" value={euro(selectedCalc.guaranteedSaving)} note="bankable annual value" />
          <Kpi label="Annual Net Cashflow" value={euro(selectedAnnual)} note="after recurring OPEX" />
          <Kpi label="Payback" value={selectedPayback ? `${num(selectedPayback, 1)} yrs` : "N/A"} note={project.includeOperationalUpside ? "with upside" : "base case"} />
          <Kpi label="NPV" value={euro(selectedNpv)} note={`${num(assumptions.discountRatePct, 1)}% discount rate`} />
          <Kpi label="IRR" value={selectedIrr ? pct(selectedIrr) : "N/A"} note="project cash yield" />
          <Kpi label="10Y Net Savings" value={euro(selectedTenYear)} note="selected case" />
          <Kpi label="Energy Reduction" value={pct(selectedCalc.energyReductionPct)} note="selected package" />
          <Kpi label="Operational Upside" value={euro(selectedCalc.operationalUpside)} note="not in base case" />
        </section>

        <section style={styles.mainGrid}>
          <div style={styles.cardLarge}>
            <SectionTitle title="Project Input" sub="Customer-facing assumptions" />
            <div style={styles.formGrid}>
              <Input label="Customer" value={project.customerName} onChange={(value) => updateProject("customerName", value)} />
              <Input label="Municipality" value={project.municipality} onChange={(value) => updateProject("municipality", value)} />
              <Input label="Country" value={project.country} onChange={(value) => updateProject("country", value)} />
              <Input label="Contact person" value={project.contactPerson} onChange={(value) => updateProject("contactPerson", value)} />
              <Input label="Proposal date" type="date" value={project.proposalDate} onChange={(value) => updateProject("proposalDate", value)} />
              <Input label="Quantity" type="number" value={project.quantity} onChange={(value) => updateProject("quantity", toNumber(value))} />
              <Input label="Existing wattage" type="number" value={project.existingWatt} onChange={(value) => updateProject("existingWatt", toNumber(value))} />
              <label style={styles.field}>
                <span style={styles.label}>Product</span>
                <select style={styles.input} value={project.selectedProductId} onChange={(event) => updateProject("selectedProductId", event.target.value)}>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} – {product.watt}W – {euro(product.sellPrice)}</option>)}
                </select>
              </label>
            </div>
            <div style={styles.toggleGrid}>
              <Toggle label="Installation included" checked={project.includeInstallation} onChange={(value) => updateProject("includeInstallation", value)} />
              <Toggle label="Maintenance saving" checked={project.includeMaintenance} onChange={(value) => updateProject("includeMaintenance", value)} />
            </div>
            <label style={styles.field}>
              <span style={styles.label}>Notes</span>
              <textarea style={styles.textarea} value={project.notes} onChange={(event) => updateProject("notes", event.target.value)} />
            </label>
          </div>

          <div style={styles.card}>
            <SectionTitle title="Guaranteed Value Stack" sub={selectedCalc.offer.title} />
            <ValueLine label="LED energy saving" value={selectedCalc.ledSaving} max={selectedCalc.guaranteedSaving} />
            <ValueLine label="CLO saving" value={selectedCalc.cloSaving} max={selectedCalc.guaranteedSaving} />
            <ValueLine label="Maintenance saving" value={selectedCalc.maintenanceSaving} max={selectedCalc.guaranteedSaving} />
            <ValueLine label="PowerAiD saving" value={selectedCalc.powerAidSaving} max={selectedCalc.guaranteedSaving} />
            <ValueLine label="Recurring OPEX" value={-selectedCalc.annualNewOpex} max={selectedCalc.guaranteedSaving} negative />
          </div>
        </section>

        <section style={styles.threeGrid}>
          <div style={styles.card}>
            <SectionTitle title="Operational Upside" sub="Separated from base case" />
            <ValueLine label="Service efficiency" value={selectedCalc.serviceEfficiencySaving} max={selectedCalc.operationalUpside || 1} positiveGreen />
            <ValueLine label="Fewer failures" value={selectedCalc.fewerFailuresSaving} max={selectedCalc.operationalUpside || 1} positiveGreen />
            <ValueLine label="Admin reduction" value={selectedCalc.adminReductionSaving} max={selectedCalc.operationalUpside || 1} positiveGreen />
          </div>
          <div style={styles.card}>
            <SectionTitle title="Strategic Upside" sub="Not monetised by default" />
            <ul style={styles.bulletList}>
              <li>ESG / reporting readiness</li>
              <li>Green financing narrative</li>
              <li>Smart city sensor platform</li>
              <li>Municipal data infrastructure</li>
              <li>Asset digitalisation</li>
            </ul>
          </div>
          <div style={styles.card}>
            <SectionTitle title="Evidence Required" sub="Bank-grade documentation" />
            <ul style={styles.bulletList}>
              <li>Existing wattage inventory</li>
              <li>Energy invoice / tariff</li>
              <li>Burning hours assumption</li>
              <li>Maintenance cost baseline</li>
              <li>CMS / dimming logs</li>
            </ul>
          </div>
        </section>

        {showAdminPanel && (
          <section style={styles.twoGrid}>
            <div style={styles.card}>
              <SectionTitle title="Admin Assumptions" sub="EU decimal input accepted" />
              <div style={styles.formGrid}>
                {Object.entries(assumptions).map(([key, value]) => (
                  <Input key={key} label={key} type="number" value={value} onChange={(inputValue) => updateAssumption(key, inputValue)} />
                ))}
              </div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardTop}>
                <SectionTitle title="Product Override" sub="Protected catalogue editing" />
                <span style={styles.adminOn}>Admin</span>
              </div>
              <div style={styles.stack}>
                <div style={styles.buttonRow}>
                  <label style={styles.importButtonDark}>Import Product Catalogue<input type="file" accept=".xlsx,.xls,.csv" onChange={handleProductCatalogueImport} style={{ display: "none" }} /></label>
                  <button onClick={addProduct} style={styles.primaryButton}>Add Product</button>
                  <button onClick={() => setProducts(defaultProducts)} style={styles.secondaryButton}>Reset Products</button>
                </div>
                <ProductTable products={products} updateProduct={updateProduct} />
              </div>
            </div>
          </section>
        )}

        <section style={styles.card}>
          <SectionTitle title="Customer Benefit Curve" sub="Accumulated annual net savings" />
          <div style={styles.chartBox}>
            {rows.map((row) => (
              <div key={row.year} style={styles.chartRow}>
                <span style={styles.chartYear}>{row.year}</span>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, width: `${Math.max(4, (row.cumulativeNetSaving / maxCumulative) * 100)}%` }} />
                </div>
                <span style={styles.chartValue}>{euro(row.cumulativeNetSaving)}</span>
              </div>
            ))}
          </div>
        </section>

        {showAdminPanel && (
          <section style={styles.card}>
            <SectionTitle title="Admin Cashflow Detail" sub="Base case and upside split" />
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <Th left>Year</Th>
                    <Th>Guaranteed</Th>
                    <Th>Upside</Th>
                    <Th>Included Upside</Th>
                    <Th>OPEX</Th>
                    <Th>Net</Th>
                    <Th>Cumulative</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.year} style={styles.tr}>
                      <Td left>{row.year}</Td>
                      <Td>{euro(row.guaranteedSaving)}</Td>
                      <Td>{euro(row.operationalUpside)}</Td>
                      <Td>{euro(row.includedOperationalUpside)}</Td>
                      <Td>{euro(row.newOpex)}</Td>
                      <Td strong>{euro(row.netSaving)}</Td>
                      <Td strong>{euro(row.cumulativeNetSaving)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function OfferCard({ calc, selected, onSelect }) {
  return (
    <button onClick={onSelect} style={selected ? styles.offerCardSelected : styles.offerCard}>
      <div style={styles.offerTop}>
        <span style={styles.offerTitle}>{calc.offer.title}</span>
        <span style={styles.offerBadge}>{calc.offer.badge}</span>
      </div>
      <p style={styles.offerSub}>{calc.offer.positioning}</p>
      <div style={styles.offerMetrics}>
        <div>
          <small>Base Payback</small>
          <b>{calc.basePaybackYears ? `${num(calc.basePaybackYears, 1)} yrs` : "N/A"}</b>
        </div>
        <div>
          <small>Base 10Y Net</small>
          <b>{euro(calc.baseTenYearNetSavings)}</b>
        </div>
      </div>
      <div style={styles.offerFoot}>Upside: {euro(calc.operationalUpside)} / year</div>
    </button>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionSub}>{sub}</p>
    </div>
  );
}

function Kpi({ label, value, note }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiNote}>{note}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={type === "number" ? inputNumber(value) : value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={styles.toggle}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function Th({ children, left }) {
  return <th style={left ? styles.thLeft : styles.thRight}>{children}</th>;
}

function Td({ children, left, strong }) {
  return <td style={left ? styles.tdLeft : strong ? styles.tdStrong : styles.tdRight}>{children}</td>;
}

function ValueLine({ label, value, max, negative, positiveGreen }) {
  const abs = Math.abs(toNumber(value));
  const pctWidth = Math.max(4, Math.min(100, (abs / Math.max(1, toNumber(max))) * 100));
  let fill = "linear-gradient(90deg,#2563eb,#60a5fa)";
  if (negative) fill = "#ef4444";
  if (positiveGreen) fill = "linear-gradient(90deg,#16a34a,#86efac)";
  return (
    <div style={styles.valueLine}>
      <div style={styles.valueLineTop}>
        <span>{label}</span>
        <b>{negative ? `-${euro(abs)}` : euro(abs)}</b>
      </div>
      <div style={styles.valueTrack}>
        <div style={{ ...styles.valueFill, background: fill, width: `${pctWidth}%` }} />
      </div>
    </div>
  );
}

function ProductTable({ products, updateProduct }) {
  return (
    <div style={styles.tableWrapSmall}>
      <table style={styles.table}>
        <thead>
          <tr>
            <Th left>Name</Th>
            <Th>W</Th>
            <Th>lm</Th>
            <Th>Sell</Th>
            <Th>Buy</Th>
            <Th>Install</Th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} style={styles.tr}>
              <td style={styles.tdLeft}>
                <input style={styles.adminInputWide} value={product.name} onChange={(event) => updateProduct(product.id, "name", event.target.value)} />
              </td>
              {["watt", "lumen", "sellPrice", "buyPrice", "install"].map((field) => (
                <td key={field} style={styles.tdRight}>
                  <input
                    style={styles.adminInput}
                    value={inputNumber(product[field])}
                    inputMode="decimal"
                    onChange={(event) => updateProduct(product.id, field, event.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f5f7fb", color: "#0f172a", padding: 24, fontFamily: "Inter, Segoe UI, Arial, sans-serif" },
  shell: { maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", padding: 18, border: "1px solid #e2e8f0", borderRadius: 24, background: "#fff", boxShadow: "0 10px 28px rgba(15,23,42,.06)", flexWrap: "wrap" },
  brandRow: { display: "flex", gap: 14, alignItems: "center" },
  logoMark: { width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: "#0f172a", color: "#fff", fontWeight: 900, fontSize: 24, border: 0, cursor: "pointer" },
  title: { margin: 0, fontSize: 32, letterSpacing: "-0.035em", fontWeight: 850 },
  subtitle: { margin: "5px 0 0", color: "#64748b", fontSize: 14 },
  headerActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  primaryButton: { border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  ghostButton: { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", borderRadius: 14, padding: "11px 16px", fontWeight: 700, cursor: "pointer" },
  loginBar: { display: "flex", gap: 10, alignItems: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 14 },
  loginInput: { width: 280, border: "1px solid #cbd5e1", borderRadius: 14, padding: "11px 13px" },
  toast: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#16a34a", color: "#fff", borderRadius: 14, padding: "12px 16px" },
  toastError: { position: "fixed", top: 18, right: 18, zIndex: 50, background: "#dc2626", color: "#fff", borderRadius: 14, padding: "12px 16px" },
  offerGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 },
  offerCard: { textAlign: "left", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, cursor: "pointer", boxShadow: "0 10px 28px rgba(15,23,42,.05)" },
  offerCardSelected: { textAlign: "left", background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 22, padding: 17, cursor: "pointer", boxShadow: "0 10px 28px rgba(37,99,235,.12)" },
  offerTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  offerTitle: { fontSize: 21, fontWeight: 900 },
  offerBadge: { background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800 },
  offerSub: { color: "#64748b", margin: "8px 0 16px" },
  offerMetrics: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  offerFoot: { marginTop: 12, color: "#16a34a", fontSize: 12, fontWeight: 800 },
  auditBar: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", padding: 18, border: "1px solid #bbf7d0", borderRadius: 20, background: "#f0fdf4", flexWrap: "wrap" },
  auditMini: { marginTop: 6, color: "#166534", fontSize: 13, fontWeight: 700 },
  importButton: { border: "1px solid #16a34a", background: "#16a34a", color: "#fff", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer" },
  importButtonDark: { border: "1px solid #0f172a", background: "#0f172a", color: "#fff", borderRadius: 14, padding: "11px 16px", fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center" },
  caseToggleRow: { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", padding: 18, border: "1px solid #dbeafe", borderRadius: 20, background: "#eff6ff", flexWrap: "wrap" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 },
  kpiCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 22, padding: 18, boxShadow: "0 10px 28px rgba(15,23,42,.06)" },
  kpiLabel: { color: "#64748b", fontSize: 13, fontWeight: 800 },
  kpiValue: { fontSize: 29, lineHeight: 1.15, marginTop: 8, fontWeight: 900, letterSpacing: "-0.04em" },
  kpiNote: { color: "#94a3b8", fontSize: 12, marginTop: 7 },
  mainGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 },
  twoGrid: { display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 24 },
  threeGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 28px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", gap: 18 },
  cardLarge: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24, padding: 24, boxShadow: "0 10px 28px rgba(15,23,42,.06)", display: "flex", flexDirection: "column", gap: 18 },
  cardTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  sectionTitle: { margin: 0, fontSize: 23, fontWeight: 850, letterSpacing: "-0.025em" },
  sectionSub: { margin: "5px 0 0", color: "#64748b", fontSize: 13 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 15 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { color: "#334155", fontSize: 13, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  textarea: { width: "100%", minHeight: 104, boxSizing: "border-box", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 15, padding: "12px 13px", fontSize: 15, outline: "none" },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #cbd5e1", background: "#f8fafc", padding: "12px 13px", borderRadius: 15, fontWeight: 750, gap: 14 },
  valueLine: { display: "flex", flexDirection: "column", gap: 7 },
  valueLineTop: { display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 800 },
  valueTrack: { height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  valueFill: { height: "100%", borderRadius: 999 },
  chartBox: { display: "flex", flexDirection: "column", gap: 11 },
  chartRow: { display: "grid", gridTemplateColumns: "28px 1fr 95px", gap: 10, alignItems: "center" },
  chartYear: { color: "#475569", fontWeight: 800 },
  barTrack: { height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", background: "linear-gradient(90deg,#2563eb,#60a5fa)", borderRadius: 999 },
  chartValue: { textAlign: "right", fontWeight: 800, fontSize: 12 },
  tableWrap: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 16 },
  tableWrapSmall: { overflowX: "auto", maxHeight: 390, border: "1px solid #e2e8f0", borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  thLeft: { textAlign: "left", background: "#f8fafc", color: "#64748b", padding: 12, whiteSpace: "nowrap" },
  thRight: { textAlign: "right", background: "#f8fafc", color: "#64748b", padding: 12, whiteSpace: "nowrap" },
  tr: { borderTop: "1px solid #e2e8f0" },
  tdLeft: { textAlign: "left", padding: 12, whiteSpace: "nowrap" },
  tdRight: { textAlign: "right", padding: 12, whiteSpace: "nowrap" },
  tdStrong: { textAlign: "right", padding: 12, whiteSpace: "nowrap", fontWeight: 900 },
  adminInput: { width: 92, textAlign: "right", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 9px" },
  adminInputWide: { width: 205, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 9px" },
  stack: { display: "flex", flexDirection: "column", gap: 14 },
  buttonRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  adminOn: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "8px 11px", fontSize: 12, fontWeight: 800 },
  bulletList: { margin: 0, paddingLeft: 20, color: "#334155", lineHeight: 1.8 },
};
