import { numberValue } from "./calculations.js";
import { SALUZZO_VIA_RAMELLO_AUDIT_NOTE, uid } from "./model.js";

const aliases = {
  technology: ["technology", "tecnologia", "lamp type", "lampetype", "luminaire type", "fixture type", "light source", "tipo lampada", "tipo apparecchio"],
  wattage: ["wattage", "watt", "watts", "power", "potenza", "potenza w", "effekt", "w"],
  quantity: ["quantity", "qty", "count", "number", "numero", "quantita", "quantità", "antal", "number of lamps", "numero lampade"],
  name: ["group", "group name", "name", "street", "location", "gruppo", "nome", "via", "strada", "gruppe", "gade"],
  assetId: ["asset id", "asset_id", "pole id", "pole_id", "lamp id", "luminaire id", "id lampada", "id palo", "matricola"],
  category: ["category", "categoria", "lighting category", "road category", "classe", "classificazione"],
  replacementRequirement: ["replacement requirement", "replacement", "intervento", "tipo intervento", "requisito sostituzione"],
  currentLuminaireModel: ["current model", "existing model", "luminaire model", "modello attuale", "modello apparecchio"],
  notes: ["notes", "note", "comment", "comments", "osservazioni"],
};

const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[_/()-]+/g, " ").replace(/\s+/g, " ");

export function guessLightingMapping(headers) {
  const mapping = { technology: "", wattage: "", quantity: "", name: "", assetId: "", category: "", replacementRequirement: "", currentLuminaireModel: "", notes: "" };
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
  const inputSheets = isCsv ? [{ sheet: file.name, data: parseCsv(await file.text()) }] : await (await import("read-excel-file/browser")).default(file);
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

const mappedText = (row, mapping, field) => mapping[field] === "" || mapping[field] == null ? "" : String(row[Number(mapping[field])] ?? "").trim();
const saluzzoIdentity = (context = {}) => clean([context.fileName, context.sheetName, context.projectName, context.customerName].filter(Boolean).join(" ")).includes("saluzzo");

export function buildImportedGroups(rows, mapping, ledProducts, language = "it", mode = "grouped", context = {}) {
  const wattageIndex = Number(mapping.wattage);
  const technologyIndex = mapping.technology === "" ? null : Number(mapping.technology);
  const quantityIndex = mapping.quantity === "" ? null : Number(mapping.quantity);
  const nameIndex = mapping.name === "" ? null : Number(mapping.name);
  const assetIdIndex = mapping.assetId === "" || mapping.assetId == null ? null : Number(mapping.assetId);
  const firstProduct = ledProducts.find((product) => product.active)?.id || ledProducts[0]?.id || "";
  const grouped = new Map();
  let skipped = 0;

  rows.forEach((row, rowIndex) => {
    const suppliedName = nameIndex == null ? "" : String(row[nameIndex] ?? "").trim();
    const viaRamello = saluzzoIdentity(context) && clean(suppliedName).includes("via ramello");
    const wattage = viaRamello && !(numberValue(row[wattageIndex]) > 0) ? 100 : numberValue(row[wattageIndex]);
    const rawQuantity = quantityIndex == null ? 1 : numberValue(row[quantityIndex]);
    const quantity = viaRamello && !(rawQuantity > 0) ? 14 : rawQuantity;
    if (!(wattage > 0) || !(quantity > 0)) {
      skipped += 1;
      return;
    }
    const technology = viaRamello ? "SAP" : technologyIndex == null ? "OTHER" : normalizeTechnology(row[technologyIndex]);
    const assetId = assetIdIndex == null ? "" : String(row[assetIdIndex] ?? "").trim();
    const category = viaRamello ? "Stradale" : mappedText(row, mapping, "category");
    const replacementRequirement = viaRamello ? "Sostituzione completa" : mappedText(row, mapping, "replacementRequirement");
    const currentLuminaireModel = mappedText(row, mapping, "currentLuminaireModel");
    const notes = viaRamello ? [mappedText(row, mapping, "notes"), SALUZZO_VIA_RAMELLO_AUDIT_NOTE].filter(Boolean).join(" | ") : mappedText(row, mapping, "notes");
    const metadata = { category, replacementRequirement, currentLuminaireModel, notes, ...(viaRamello ? { dataQuality: "assumption", source: "ProjectInputSheet" } : {}) };
    if (mode === "individual") {
      const count = Math.max(1, Math.round(quantity));
      for (let item = 0; item < count; item += 1) {
        const suffix = count > 1 ? ` #${item + 1}` : "";
        const fallback = suppliedName ? `${suppliedName}${suffix || ` #${rowIndex + 1}`}` : `${language === "it" ? "Lampada" : "Luminaire"} ${rowIndex + 1}${suffix}`;
        grouped.set(`individual-${rowIndex}-${item}`, { id: uid(), name: viaRamello ? `Via Ramello – miglioria criterio H${suffix}` : assetId ? `${assetId}${suffix}` : fallback, quantity: 1, technology, existingWattage: wattage, proposedProductId: firstProduct, smartAssigned: true, powerAidAssigned: true, ...metadata });
      }
      return;
    }
    const normalizedName = viaRamello ? "Via Ramello – miglioria criterio H" : suppliedName;
    const key = [normalizedName, category, wattage, technology, replacementRequirement, currentLuminaireModel].map(clean).join("|");
    const existing = grouped.get(key);
    if (existing) existing.quantity += quantity;
    else grouped.set(key, { id: uid(), name: normalizedName || `${technology} ${wattage} W`, quantity, technology, existingWattage: wattage, proposedProductId: firstProduct, smartAssigned: true, powerAidAssigned: true, ...metadata });
  });

  const groups = [...grouped.values()].sort((a, b) => a.technology.localeCompare(b.technology) || a.existingWattage - b.existingWattage || a.name.localeCompare(b.name));
  const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0);
  return { groups, skipped, totalQuantity, message: language === "it" ? `${groups.length} gruppi, ${totalQuantity} apparecchi` : `${groups.length} groups, ${totalQuantity} luminaires` };
}
