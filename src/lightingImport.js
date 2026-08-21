import readExcelFile from "read-excel-file/browser";
import { numberValue } from "./calculations.js";
import { uid } from "./model.js";

const aliases = {
  technology: ["technology", "tecnologia", "lamp type", "lampetype", "luminaire type", "fixture type", "light source", "tipo lampada", "tipo apparecchio", "tipo di tecnologia"],
  wattage: ["wattage", "watt", "watts", "power", "potenza", "potenza w", "effekt", "w", "wattagi"],
  quantity: ["quantity", "qty", "count", "number", "numero", "quantita", "quantità", "antal", "number of lamps", "numero lampade", "numero di apparecchi"],
  name: ["group", "group name", "name", "street", "location", "gruppo", "nome", "via", "strada", "gruppe", "gade"],
  assetId: ["asset id", "asset_id", "pole id", "pole_id", "lamp id", "luminaire id", "id lampada", "id palo", "matricola"],
};

const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[_/()-]+/g, " ").replace(/\s+/g, " ");
const isTotalLabel = (value) => /^(grand total|hovedtotal|total|totale generale|totale complessivo|i alt)$/.test(clean(value));

export function guessLightingMapping(headers) {
  const mapping = { technology: "", wattage: "", quantity: "", name: "", assetId: "" };
  Object.keys(mapping).forEach((field) => {
    const index = headers.findIndex((header) => aliases[field].some((alias) => clean(header) === alias || clean(header).includes(alias)));
    if (index >= 0) mapping[field] = String(index);
  });
  return mapping;
}

export function normalizeTechnology(value) {
  const text = clean(value);
  if (/\bled\b/.test(text)) return "LED";
  if (/\b(sap|hps|sodium|natrium|sodio)\b/.test(text)) return "SAP";
  if (/\b(mh|metal halide|halogenuri|metalhalogen)\b/.test(text)) return "MH";
  if (/\b(mercury|hql|kviksølv|mercurio)\b/.test(text)) return "MERCURY";
  return "OTHER";
}

function targetLedWattage(existingWattage, technology) {
  const wattage = Math.max(0, numberValue(existingWattage));
  if (!wattage) return 0;
  if (technology === "LED") return wattage * 0.70;
  if (["SAP", "MH", "MERCURY"].includes(technology)) return wattage / 3;
  return wattage * 0.50;
}

export function recommendLedProduct(existingWattage, technology, ledProducts = []) {
  const target = targetLedWattage(existingWattage, technology);
  const active = ledProducts.filter((product) => product.active !== false && numberValue(product.wattage) > 0);
  const candidates = active.length ? active : ledProducts.filter((product) => numberValue(product.wattage) > 0);
  if (!candidates.length) return { product: null, targetWattage: Math.round(target * 10) / 10 };
  const product = [...candidates].sort((a, b) => {
    const aDelta = Math.abs(numberValue(a.wattage) - target);
    const bDelta = Math.abs(numberValue(b.wattage) - target);
    return aDelta - bDelta || numberValue(a.wattage) - numberValue(b.wattage);
  })[0];
  return { product, targetWattage: Math.round(target * 10) / 10 };
}

const uniqueHeaders = (values) => {
  const used = new Map();
  return values.map((value, index) => {
    const base = String(value ?? "").trim() || `Column ${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
};

export function applyOfficialInputSheetLayout(name, headers) {
  const sheetName = String(name || "");
  if (/^ProjectInputSheet_ITA$/i.test(sheetName) && headers.length >= 4) {
    // Italian template: B=technology, C=wattage, D=quantity.
    headers[1] = "Tipo di Tecnologia";
    headers[2] = "Wattagi";
    headers[3] = "Numero di apparecchi";
  } else if (/^ProjectInputSheet(?:_(ENG|DA))?$/i.test(sheetName) && headers.length >= 7) {
    // English/Danish template: C=technology, D=quantity, G=nominal wattage.
    headers[2] = "Tipo lampada";
    headers[3] = "Quantità";
    headers[6] = "Potenza (W)";
  }
  return headers;
}

export function parseWattageValue(value) {
  const direct = numberValue(value);
  if (direct > 0) return direct;
  const match = String(value ?? "").trim().match(/[-+]?\d+(?:[.,]\d+)?/);
  return match ? Math.max(0, numberValue(match[0])) : 0;
}

export async function readLightingWorkbook(file) {
  const isCsv = /\.csv$/i.test(file.name);
  const inputSheets = isCsv ? [{ sheet: file.name, data: parseCsv(await file.text()) }] : await readExcelFile(file);
  return inputSheets.map(({ sheet: name, data }) => {
    const matrix = data.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell).trim() !== ""));
    if (headerIndex < 0) return { name, headers: [], rows: [] };
    const headers = applyOfficialInputSheetLayout(name, uniqueHeaders(matrix[headerIndex]));
    return {
      name,
      headers,
      projectIdCellC6: String(data?.[5]?.[2] ?? "").trim(),
      rows: matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell).trim() !== "")),
    };
  });
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); if (row.some((cell) => cell.trim() !== "")) rows.push(row); row = []; value = "";
    } else value += character;
  }
  row.push(value); if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function importedGroupBase({ name, quantity, technology, wattage, ledProducts }) {
  const recommendation = recommendLedProduct(wattage, technology, ledProducts);
  return {
    id: uid(), name, quantity, technology, existingWattage: wattage,
    upgradeSelected: true,
    proposedProductId: recommendation.product?.id || "",
    projectLedWattage: recommendation.product ? numberValue(recommendation.product.wattage) : recommendation.targetWattage,
    importedRecommendedWattage: recommendation.targetWattage,
    smartAssigned: true, powerAidAssigned: true,
  };
}

export function buildImportedGroups(rows, mapping, ledProducts, language = "it", mode = "grouped") {
  const wattageIndex = Number(mapping.wattage);
  const technologyIndex = mapping.technology === "" ? null : Number(mapping.technology);
  const quantityIndex = mapping.quantity === "" ? null : Number(mapping.quantity);
  const nameIndex = mapping.name === "" ? null : Number(mapping.name);
  const assetIdIndex = mapping.assetId === "" || mapping.assetId == null ? null : Number(mapping.assetId);
  const grouped = new Map();
  let skipped = 0;

  rows.forEach((row, rowIndex) => {
    const wattage = parseWattageValue(row[wattageIndex]);
    const quantity = quantityIndex == null ? 1 : numberValue(row[quantityIndex]);
    if (!(wattage > 0) || !(quantity > 0)) { skipped += 1; return; }
    const technology = technologyIndex == null ? "OTHER" : normalizeTechnology(row[technologyIndex]);
    const suppliedName = nameIndex == null ? "" : String(row[nameIndex] ?? "").trim();
    const assetId = assetIdIndex == null ? "" : String(row[assetIdIndex] ?? "").trim();

    if (mode === "individual") {
      const count = Math.max(1, Math.round(quantity));
      for (let item = 0; item < count; item += 1) {
        const suffix = count > 1 ? ` #${item + 1}` : "";
        const fallback = suppliedName ? `${suppliedName}${suffix || ` #${rowIndex + 1}`}` : `${language === "it" ? "Lampada" : "Luminaire"} ${rowIndex + 1}${suffix}`;
        grouped.set(`individual-${rowIndex}-${item}`, importedGroupBase({
          name: assetId ? `${assetId}${suffix}` : fallback,
          quantity: 1, technology, wattage, ledProducts,
        }));
      }
      return;
    }

    const key = `${technology}|${wattage}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += quantity;
    else grouped.set(key, importedGroupBase({ name: `${technology} ${wattage} W`, quantity, technology, wattage, ledProducts }));
  });

  const groups = [...grouped.values()].sort((a, b) => a.technology.localeCompare(b.technology) || a.existingWattage - b.existingWattage);
  const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0);
  return { groups, skipped, totalQuantity, message: language === "it" ? `${groups.length} gruppi, ${totalQuantity} apparecchi` : `${groups.length} groups, ${totalQuantity} luminaires` };
}

export function parsePlannerWorkbook(sheets, ledProducts, fileName = "") {
  const pivot = sheets.find(item => clean(item.name) === "pivot");
  const centre = sheets.find(item => clean(item.name) === "centro luminoso");
  if (!pivot && !centre) throw new Error("Planner workbook must contain PIVOT or Centro luminoso.");
  const rows = pivot ? [pivot.headers, ...pivot.rows] : [];
  const header = rows.find(row => row.some(value => /row labels|rækkeetiketter|etichette di riga/.test(clean(value)))) || pivot?.headers || [];
  let codeIndex = header.findIndex(value => /row labels|rækkeetiketter|etichette di riga/.test(clean(value)));
  let quantityIndex = header.findIndex(value => /antal af numero lampade|count of numero lampade|conteggio.*lampade|quantita|quantità/.test(clean(value)));
  let powerSumIndex = header.findIndex(value => /sum of pow w|somma.*pow/.test(clean(value)));
  const inferredRow = rows.find(row => { const label = String(row?.[0] ?? "").trim(); return label && !isTotalLabel(label) && numberValue(row?.[1]) > 0; });
  if (pivot && (codeIndex < 0 || quantityIndex < 0) && inferredRow) { codeIndex = 0; quantityIndex = 1; if (powerSumIndex < 0 && inferredRow.length > 2) powerSumIndex = 2; }
  if (pivot && (codeIndex < 0 || quantityIndex < 0)) throw new Error("PIVOT does not contain readable product rows.");

  const centreRows = centre ? [centre.headers, ...centre.rows] : [];
  const centreHeader = centreRows[0] || [];
  const centreCodeIndex = centreHeader.findIndex(value => ["new code", "codifica armature"].includes(clean(value)));
  const centreExistingPowerIndex = centreHeader.findIndex(value => clean(value) === "potm tot");
  const centreProposedPowerIndex = centreHeader.findIndex(value => clean(value) === "pow w");
  const technicalByCode = new Map();
  if (centreCodeIndex >= 0) centreRows.slice(1).forEach(row => {
    const code = String(row[centreCodeIndex] ?? "").trim(); if (!code || /^#|grand total/i.test(code)) return;
    const existing = numberValue(row[centreExistingPowerIndex]); const proposed = numberValue(row[centreProposedPowerIndex]);
    const item = technicalByCode.get(code) || { count: 0, existingTotal: 0, existingCount: 0, proposedTotal: 0, proposedCount: 0 };
    item.count += 1; if (existing > 0) { item.existingTotal += existing; item.existingCount += 1; } if (proposed > 0) { item.proposedTotal += proposed; item.proposedCount += 1; } technicalByCode.set(code, item);
  });
  const activeProducts = ledProducts.filter(product => product.active !== false);
  const fallbackProducts = activeProducts.length ? activeProducts : ledProducts;
  const closestProduct = wattage => [...fallbackProducts].sort((a,b) => Math.abs(numberValue(a.wattage)-wattage)-Math.abs(numberValue(b.wattage)-wattage))[0];
  const groups = (pivot ? pivot.rows : []).map(row => {
    const code = String(row[codeIndex] ?? "").trim(); const quantity = Math.round(numberValue(row[quantityIndex])); if (!code || isTotalLabel(code) || !(quantity > 0)) return null;
    const technical = technicalByCode.get(code);
    const proposedWattage = technical?.proposedCount ? technical.proposedTotal / technical.proposedCount : numberValue(row[powerSumIndex]) / quantity;
    const existingWattage = technical?.existingCount ? technical.existingTotal / technical.existingCount : proposedWattage;
    const product = closestProduct(proposedWattage);
    return { id: uid(), name: code, quantity, technology: "OTHER", existingWattage: Math.round(existingWattage * 10) / 10, proposedProductId: product?.id || "", projectLedPrice: null, projectLedWattage: product?.wattage ?? Math.round(proposedWattage * 10) / 10, upgradeSelected: true, smartAssigned: true, powerAidAssigned: false, importedProductCode: code, importedProposedWattage: Math.round(proposedWattage * 10) / 10 };
  }).filter(Boolean);
  if (!groups.length) throw new Error("No valid luminaires were found in the Planner workbook.");
  const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0);
  const rawName = fileName.replace(/\.xlsx?$/i, "").replace(/^AC_\d+_\d+_/i, "").replace(/_/g, " ").trim();
  const match = rawName.match(/COMUNE DI (.+?)(?: RIQUALIFICAZIONE|$)/i); const projectName = match ? match[1].trim().replace(/\b\w/g, letter => letter.toUpperCase()) : rawName;
  const warnings = []; const rawMappedCount = [...technicalByCode.entries()].filter(([code]) => groups.some(group => group.importedProductCode === code)).reduce((sum,[,item]) => sum + item.count, 0);
  if (rawMappedCount && rawMappedCount !== totalQuantity) warnings.push(`PIVOT total (${totalQuantity}) differs from mapped raw rows (${rawMappedCount}); PIVOT total was used.`);
  return { type: "planner", source: pivot ? "Planner PIVOT + Centro luminoso" : "Centro luminoso", projectName: projectName || "Imported Planner project", customerName: projectName || "", totalQuantity, groups, productMix: groups.map(group => ({ code: group.importedProductCode, quantity: group.quantity, proposedWattage: group.importedProposedWattage })), warnings };
}

export function detectWorkbookType(sheets) {
  if (sheets.some(item => clean(item.name) === "crm import")) return "noleggio";
  if (sheets.some(item => ["pivot", "centro luminoso"].includes(clean(item.name)))) return "planner";
  return "lighting";
}

const crmImportNumberFields = new Set(["lamps","capex","contract_years","financing_years","saas_years","maintenance_opex_annual","cms_connectivity_annual","saas_poweraid_annual","total_opex_annual","customer_cost_financed_annual","customer_cost_cash_annual","co2_saving_annual_tons","energy_reduction_pct","customer_roi_years"]);
const rowsWithHeaders = (sheet) => sheet ? [sheet.headers || [], ...(sheet.rows || [])] : [];
function findLabeledNumber(sheet, labels) {
  const wanted = labels.map(clean);
  for (const row of rowsWithHeaders(sheet)) for (let index = 0; index < row.length; index += 1) {
    const label = clean(row[index]); if (!wanted.some(value => label === value || label.includes(value))) continue;
    for (let valueIndex = index + 1; valueIndex < row.length; valueIndex += 1) { const value = numberValue(row[valueIndex]); if (Number.isFinite(value) && value !== 0) return value; }
  }
  return 0;
}
const findSheet = (sheets, name) => sheets.find(item => clean(item.name) === clean(name));
const cents = value => Math.round(numberValue(value) * 100) / 100;

export function parseNoleggioWorkbook(sheets) {
  const sheet = findSheet(sheets, "CRM_IMPORT"); if (!sheet) throw new Error("Workbook must contain a CRM_IMPORT sheet.");
  const fieldIndex = sheet.headers.findIndex(value => clean(value) === "field"); const valueIndex = sheet.headers.findIndex(value => clean(value) === "value");
  if (fieldIndex < 0 || valueIndex < 0) throw new Error("CRM_IMPORT must contain Field and Value columns.");
  const values = {}; sheet.rows.forEach(row => { const key = String(row[fieldIndex] ?? "").trim().toLowerCase(); if (!key) return; values[key] = crmImportNumberFields.has(key) ? numberValue(row[valueIndex]) : String(row[valueIndex] ?? "").trim(); });
  if (!values.project_name) throw new Error("CRM_IMPORT is missing project_name."); if (!(values.capex > 0)) throw new Error("CRM_IMPORT is missing a valid CAPEX.");
  const dashboard = findSheet(sheets, "Dashboard"); const offer = findSheet(sheets, "QuotationCustomer_ITA") || findSheet(sheets, "QuotationCustomer_ENG");
  const dashboardContractYears = findLabeledNumber(dashboard, ["contract period in years"]); const dashboardFinancingYears = findLabeledNumber(dashboard, ["finance / years"]); const dashboardInterestDecimal = findLabeledNumber(dashboard, ["interest rate for customer"]); const offerTotalPayments = Math.abs(findLabeledNumber(offer, ["totale pagamenti per il progetto", "total payments for the project"]));
  const sourceContractYears = Math.max(1, Math.round(values.contract_years || 1)); const sourceFinancingYears = Math.max(1, Math.round(values.financing_years || sourceContractYears)); const contractYears = Math.max(1, Math.round(dashboardContractYears || sourceContractYears)); const financingYears = Math.max(1, Math.round(dashboardFinancingYears || sourceFinancingYears)); const interestRate = dashboardInterestDecimal > 0 && dashboardInterestDecimal < 1 ? dashboardInterestDecimal * 100 : dashboardInterestDecimal;
  const rawAnnualPayment = offerTotalPayments > 0 ? offerTotalPayments / financingYears : (values.customer_cost_cash_annual || (values.customer_cost_financed_annual + values.total_opex_annual)); const allInclusiveAnnualPayment = cents(rawAnnualPayment); if (!(allInclusiveAnnualPayment > 0)) throw new Error("CRM_IMPORT is missing the all-inclusive customer payment.");
  const warnings = []; if (sourceContractYears !== contractYears) warnings.push(`CRM_IMPORT contract period (${sourceContractYears}) was stale; customer offer uses ${contractYears} years.`); if (sourceFinancingYears !== financingYears) warnings.push(`CRM_IMPORT financing period (${sourceFinancingYears}) was stale; customer offer uses ${financingYears} years.`); if (offerTotalPayments > 0 && Math.abs((values.customer_cost_cash_annual || 0) * financingYears - offerTotalPayments) > 1) warnings.push("Annual payment was recalculated from the customer offer total.");
  return { source: "CRM_IMPORT + customer offer validation", mappingVersion: 2, projectName: values.project_name, customerName: values.customer_name || values.project_name, quotationId: values.quotation_id || "", lamps: Math.max(0, Math.round(values.lamps || 0)), capex: cents(values.capex), contractYears, financingYears, serviceContractYears: contractYears, interestRate: cents(interestRate), allInclusiveAnnualPayment, totalCustomerPayments: cents(offerTotalPayments || allInclusiveAnnualPayment * financingYears), annualOpex: cents(values.total_opex_annual || 0), cmsAnnual: cents(values.cms_connectivity_annual || 0), maintenanceAnnual: cents(values.maintenance_opex_annual || 0), powerAidAnnual: cents(values.saas_poweraid_annual || 0), co2SavingTons: values.co2_saving_annual_tons || 0, energyReductionPercent: (values.energy_reduction_pct || 0) * 100, customerRoiYears: values.customer_roi_years || 0, pdfFile: values.pdf_file || "", warnings, raw: values };
}
