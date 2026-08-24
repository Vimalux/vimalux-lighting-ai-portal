import readExcelFile from "read-excel-file/browser";
import { normalizeCatalogueProduct } from "./productCatalogue.js";

const REQUIRED_HEADERS = [
  "Product ID *",
  "Brand *",
  "Product Family / Wattage Version *",
  "Product Category *",
  "Compatible Existing Categories *",
  "Replacement Strategies *",
  "Wattage (W) *",
  "Zhaga Capable *",
  "D4i Capable *",
  "Cost Price (€) *",
  "Standard Sales Price (€) *",
  "Active *",
];

const clean = (value) => String(value ?? "").trim();
const upper = (value) => clean(value).toUpperCase();
const numberValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const yesNo = (value) => ["YES", "Y", "TRUE", "1", "SI", "SÌ"].includes(upper(value));
const listValue = (value) => clean(value).split(/[,;|]/).map((item) => item.trim().toUpperCase()).filter(Boolean);

export function normalizeCatalogueSheetRows(value) {
  if (Array.isArray(value)) {
    if (value.every((row) => Array.isArray(row))) return value;
    if (value.length === 1 && value[0] && Array.isArray(value[0].rows)) return value[0].rows;
    if (value.length === 1 && value[0] && Array.isArray(value[0].data)) return value[0].data;
  }
  if (value && Array.isArray(value.rows)) return value.rows;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

function findHeaderRow(rows = []) {
  return rows.findIndex((row) => Array.isArray(row) && row.some((cell) => clean(cell) === "Product ID *"));
}

export function parseCatalogueRows(input = []) {
  const rows = normalizeCatalogueSheetRows(input);
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error('Header "Product ID *" not found in Catalogo_Prodotti.');

  const headers = rows[headerIndex].map(clean);
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const missing = REQUIRED_HEADERS.filter((header) => index[header] == null);
  if (missing.length) throw new Error(`Missing required catalogue columns: ${missing.join(", ")}`);

  const read = (row, header) => row[index[header]];
  const products = [];
  const errors = [];
  const ids = new Set();

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!Array.isArray(row) || !row.some((cell) => clean(cell))) return;
    const excelRow = headerIndex + offset + 2;
    const id = clean(read(row, "Product ID *"));
    if (!id) return;
    if (ids.has(id)) {
      errors.push(`Row ${excelRow}: duplicate Product ID ${id}`);
      return;
    }
    ids.add(id);

    const model = clean(read(row, "Product Family / Wattage Version *"));
    const wattage = numberValue(read(row, "Wattage (W) *"));
    const lumen = numberValue(read(row, "Lumens"));
    const efficiency = numberValue(read(row, "Efficiency (lm/W)")) || (wattage > 0 && lumen > 0 ? lumen / wattage : 0);
    const costPrice = numberValue(read(row, "Cost Price (€) *"));
    const salesPrice = numberValue(read(row, "Standard Sales Price (€) *"));

    if (!model) errors.push(`Row ${excelRow}: Product Family / Wattage Version is required`);
    if (!(wattage > 0)) errors.push(`Row ${excelRow}: Wattage must be greater than 0`);
    if (costPrice < 0 || salesPrice < 0) errors.push(`Row ${excelRow}: prices cannot be negative`);

    products.push(normalizeCatalogueProduct({
      id,
      brand: clean(read(row, "Brand *")),
      name: model,
      model,
      productCategory: upper(read(row, "Product Category *")),
      compatibleExistingCategories: listValue(read(row, "Compatible Existing Categories *")),
      replacementStrategies: listValue(read(row, "Replacement Strategies *")),
      wattage,
      lumen,
      efficiency,
      cctCriCode: clean(read(row, "CCT/CRI Code")),
      ip: clean(read(row, "IP")),
      ik: clean(read(row, "IK")),
      cri: clean(read(row, "CRI")),
      protectionClass: clean(read(row, "Protection Class")),
      lifetime: numberValue(read(row, "Lifetime (h)")),
      zhaga: yesNo(read(row, "Zhaga Capable *")),
      d4iDriver: yesNo(read(row, "D4i Capable *")),
      photometryUrl: clean(read(row, "Photometry / Planner Reference")),
      techSheetUrl: clean(read(row, "Tech Sheet / Certs URL")),
      costPrice,
      salesPrice,
      active: yesNo(read(row, "Active *")),
      notes: clean(read(row, "Notes")),
      catalogueSource: "excel-master",
    }));
  });

  if (errors.length) throw new Error(errors.join("\n"));
  if (!products.length) throw new Error("No product rows found in Catalogo_Prodotti.");
  return products;
}

export function mergeCatalogueProducts(existing = [], imported = []) {
  const importedById = new Map(imported.map((product) => [String(product.id), product]));
  let updated = 0;
  const merged = existing.map((product) => {
    const replacement = importedById.get(String(product.id));
    if (!replacement) return product;
    importedById.delete(String(product.id));
    updated += 1;
    return normalizeCatalogueProduct({ ...product, ...replacement, id: product.id });
  });
  const addedProducts = [...importedById.values()].map(normalizeCatalogueProduct);
  return {
    products: [...merged, ...addedProducts],
    updated,
    added: addedProducts.length,
    retained: existing.length - updated,
    imported: imported.length,
  };
}

export function selectCatalogueSheet(workbook = []) {
  if (!Array.isArray(workbook)) return null;
  const sheets = workbook.filter((item) => item && !Array.isArray(item) && typeof item === "object");
  if (!sheets.length) return null;
  const target = sheets.find((item) => clean(item.sheet).toLowerCase() === "catalogo_prodotti");
  return target || null;
}

export async function readProductCatalogueWorkbook(file) {
  if (!/\.xlsx$/i.test(file?.name || "")) throw new Error("Product catalogue import requires an .xlsx file.");

  // read-excel-file v8+ default export returns all workbook sheets as
  // [{ sheet: 'Name', data: [...] }, ...]. Read the workbook first and then
  // explicitly select Catalogo_Prodotti instead of passing the old sheet option.
  const workbook = await readExcelFile(file);
  const target = selectCatalogueSheet(workbook);

  if (!target) {
    const available = Array.isArray(workbook)
      ? workbook.map((item) => clean(item?.sheet)).filter(Boolean).join(", ")
      : "";
    throw new Error(`Catalogo_Prodotti not found in workbook.${available ? ` Available sheets: ${available}` : ""}`);
  }

  const rows = normalizeCatalogueSheetRows(target.data);
  if (!rows.length) throw new Error("Catalogo_Prodotti could not be read from the workbook.");
  return parseCatalogueRows(rows);
}
