const CATEGORY_CODES = new Set(["STREET", "URBAN", "GLOBO", "FLOODLIGHT", "UPLIGHT", "LANTERN", "RETROFIT_KIT", "OTHER"]);
const STRATEGY_CODES = new Set(["REPLACE", "RETROFIT", "EITHER", "UNKNOWN"]);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
};

const upper = (value) => String(value || "").trim().toUpperCase().replace(/[ -]+/g, "_");

export function normalizeProductCategory(value) {
  const code = upper(value);
  if (CATEGORY_CODES.has(code)) return code;
  if (["ROAD", "STREETLIGHT", "COBRA", "COBRA_HEAD"].includes(code)) return "STREET";
  if (["DECORATIVE", "URBAN_LIGHT", "ARREDO_URBANO"].includes(code)) return "URBAN";
  if (["GLOBE"].includes(code)) return "GLOBO";
  if (["FLOOD", "PROJECTOR", "PROIETTORE"].includes(code)) return "FLOODLIGHT";
  if (["IN_GROUND", "INGROUND", "INCASSO"].includes(code)) return "UPLIGHT";
  if (["LANTERNA"].includes(code)) return "LANTERN";
  if (["RETROFIT", "RETROFITKIT", "RETROFIT_KIT"].includes(code)) return "RETROFIT_KIT";
  return "OTHER";
}

export function inferProductCategory(product = {}) {
  const explicit = normalizeProductCategory(product.productCategory || product.category || product.type);
  if (explicit !== "OTHER") return explicit;

  // Older catalogue rows pre-date structured compatibility metadata. Infer only
  // VIMALUX families we know, so category-aware imports do not fall back to an
  // unrelated family merely because its wattage is numerically closer.
  const identity = upper([product.model, product.name, product.sku, product.code, product.id].filter(Boolean).join(" "));
  if (/\b(OPERA|RETRO)\b/.test(identity)) return "URBAN";
  if (/\b(MANTA|MAKO|ZETA)\b/.test(identity)) return "STREET";
  if (/\b(FL01|FLOOD|PROJECTOR|PROIETTORE)\b/.test(identity)) return "FLOODLIGHT";
  if (/\b(GLOBO|GLOBE)\b/.test(identity)) return "GLOBO";
  if (/\b(LANTERN|LANTERNA)\b/.test(identity)) return "LANTERN";
  if (/\b(UPLIGHT|INGROUND|IN_GROUND|INCASSO)\b/.test(identity)) return "UPLIGHT";
  return "OTHER";
}

export function normalizeReplacementStrategy(value) {
  const code = upper(value);
  if (STRATEGY_CODES.has(code)) return code;
  if (["COMPLETE_REPLACEMENT", "SOSTITUZIONE_COMPLETA"].includes(code)) return "REPLACE";
  if (["BOTH", "BOTH_OPTIONS", "ENTRAMBE_LE_OPZIONI"].includes(code)) return "EITHER";
  return "UNKNOWN";
}

export function normalizeCatalogueProduct(product = {}) {
  const productCategory = inferProductCategory(product);
  const compatibleExistingCategories = asArray(product.compatibleExistingCategories || product.compatibleCategories)
    .map(normalizeProductCategory)
    .filter((value, index, all) => value && all.indexOf(value) === index);
  const replacementStrategies = asArray(product.replacementStrategies || product.replacementStrategy)
    .map(normalizeReplacementStrategy)
    .filter((value, index, all) => value && value !== "UNKNOWN" && all.indexOf(value) === index);
  return {
    ...product,
    model: product.model || product.name || "",
    productCategory,
    compatibleExistingCategories,
    replacementStrategies,
    efficiency: Number(product.efficiency || 0) || (Number(product.wattage) > 0 ? Number(product.lumen || 0) / Number(product.wattage) : 0),
    cctCriCode: String(product.cctCriCode ?? product.cctCri ?? "").trim(),
    // Legacy fields are retained for existing catalogue rows, but new performance variants use cctCriCode (730/740/830/840 etc.).
    cct: product.cct ?? "",
    ip: product.ip ?? "",
    ik: product.ik ?? "",
    cri: product.cri ?? "",
    protectionClass: product.protectionClass ?? "",
    lifetime: Number(product.lifetime || 0) || 0,
    zhaga: Boolean(product.zhaga),
    d4iDriver: Boolean(product.d4iDriver),
    photometryUrl: product.photometryUrl || "",
    techSheetUrl: product.techSheetUrl || product.certsTechSheetUrl || "",
  };
}

export function isCatalogueProductCompatible(product, existingCategory = "OTHER", replacementRequirement = "UNKNOWN") {
  const normalized = normalizeCatalogueProduct(product);
  const existing = normalizeProductCategory(existingCategory);
  const requirement = normalizeReplacementStrategy(replacementRequirement);

  // Structured compatibility metadata is authoritative. For legacy VIMALUX
  // rows, the inferred product family becomes the category guard. Truly
  // unknown legacy rows remain selectable until the master catalogue is fully
  // migrated, preserving backwards compatibility without allowing MANTA to
  // masquerade as an urban luminaire (or OPERA as a street luminaire).
  const categoryOk = normalized.compatibleExistingCategories.length > 0
    ? normalized.compatibleExistingCategories.includes(existing) || normalized.compatibleExistingCategories.includes("OTHER")
    : existing === "OTHER" || normalized.productCategory === "OTHER" || normalized.productCategory === existing;

  const strategyOk = normalized.replacementStrategies.length === 0
    || requirement === "UNKNOWN"
    || requirement === "EITHER"
    || normalized.replacementStrategies.includes(requirement)
    || normalized.replacementStrategies.includes("EITHER");

  return categoryOk && strategyOk;
}

export function compatibleLedProducts(products = [], existingCategory = "OTHER", replacementRequirement = "UNKNOWN") {
  return products.filter((product) => product?.active !== false)
    .filter((product) => isCatalogueProductCompatible(product, existingCategory, replacementRequirement));
}
