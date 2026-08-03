import readExcelFile from "read-excel-file/browser";
import { numberValue } from "./calculations.js";
import { uid } from "./model.js";

const aliases = {
  technology: ["technology", "tecnologia", "lamp type", "lampetype", "luminaire type", "fixture type", "light source", "tipo lampada", "tipo apparecchio"],
  wattage: ["wattage", "watt", "watts", "power", "potenza", "potenza w", "effekt", "w"],
  quantity: ["quantity", "qty", "count", "number", "numero", "quantita", "quantità", "antal", "number of lamps", "numero lampade"],
  name: ["group", "group name", "name", "street", "location", "gruppo", "nome", "via", "strada", "gruppe", "gade"],
};

const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[_/()-]+/g, " ").replace(/\s+/g, " ");

export function guessLightingMapping(headers) {
  const mapping = { technology: "", wattage: "", quantity: "", name: "" };
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

const uniqueHeaders = (values) => {
  const used = new Map();
  return values.map((value, index) => {
    const base = String(value ?? "").trim() || `Column ${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
};

export async function readLightingWorkbook(file) {
  const isCsv = /\.csv$/i.test(file.name);
  const inputSheets = isCsv ? [{ sheet: file.name, data: parseCsv(await file.text()) }] : await readExcelFile(file);
  return inputSheets.map(({ sheet: name, data }) => {
    const matrix = data.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
    const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell).trim() !== ""));
    if (headerIndex < 0) return { name, headers: [], rows: [] };
    return {
      name,
      headers: uniqueHeaders(matrix[headerIndex]),
      rows: matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell).trim() !== "")),
    };
  });
}

function parseCsv(text) {
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) || []).length > (text.split(/\r?\n/, 1)[0].match(/,/g) || []).length ? ";" : ",";
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

export function buildImportedGroups(rows, mapping, ledProducts, language = "it") {
  const wattageIndex = Number(mapping.wattage);
  const technologyIndex = mapping.technology === "" ? null : Number(mapping.technology);
  const quantityIndex = mapping.quantity === "" ? null : Number(mapping.quantity);
  const nameIndex = mapping.name === "" ? null : Number(mapping.name);
  const firstProduct = ledProducts.find((product) => product.active)?.id || ledProducts[0]?.id || "";
  const grouped = new Map();
  let skipped = 0;

  rows.forEach((row) => {
    const wattage = numberValue(row[wattageIndex]);
    const quantity = quantityIndex == null ? 1 : numberValue(row[quantityIndex]);
    if (!(wattage > 0) || !(quantity > 0)) {
      skipped += 1;
      return;
    }
    const technology = technologyIndex == null ? "OTHER" : normalizeTechnology(row[technologyIndex]);
    const suppliedName = nameIndex == null ? "" : String(row[nameIndex] ?? "").trim();
    const key = `${suppliedName.toLowerCase()}|${technology}|${wattage}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += quantity;
    else grouped.set(key, { id: uid(), name: suppliedName || `${technology} ${wattage} W`, quantity, technology, existingWattage: wattage, proposedProductId: firstProduct, smartAssigned: true, powerAidAssigned: true });
  });

  const groups = [...grouped.values()].sort((a, b) => a.technology.localeCompare(b.technology) || a.existingWattage - b.existingWattage || a.name.localeCompare(b.name));
  const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0);
  return { groups, skipped, totalQuantity, message: language === "it" ? `${groups.length} gruppi, ${totalQuantity} apparecchi` : `${groups.length} groups, ${totalQuantity} luminaires` };
}
