const CATEGORY_CODES = new Set(["STREET", "URBAN", "GLOBO", "FLOODLIGHT", "UPLIGHT", "LANTERN", "RETROFIT_KIT", "OTHER"]);
const STRATEGY_CODES = new Set(["REPLACE", "RETROFIT", "EITHER", "UNKNOWN"]);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
};

const upper = (value) => String(value || "").trim().toUpperCase().replace(/[ -]+/g, "_");
const hasToken = (identity, token) => identity === token || identity.startsWith(`${token}_`) || identity.endsWith(`_${token}`) || identity.includes(`_${token}_`);
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function normalizeProductCategory(value) {
  const code = upper(value);
  if (CATEGORY_CODES.has(code)) return code;
  if (["ROAD", "STREETLIGHT", "COBRA", "COBRA_HEAD", "STRADALE"].includes(code)) return "STREET";
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

  const identity = upper([product.model, product.name, product.sku, product.code, product.id].filter(Boolean).join(" "));
  if (hasToken(identity, "OPERA") || hasToken(identity, "RETRO")) return "URBAN";
  if (hasToken(identity, "MANTA") || hasToken(identity, "MAKO") || hasToken(identity, "ZETA")) return "STREET";
  if (hasToken(identity, "FL01") || hasToken(identity, "FLOOD") || hasToken(identity, "PROJECTOR") || hasToken(identity, "PROIETTORE")) return "FLOODLIGHT";
  if (hasToken(identity, "GLOBO") || hasToken(identity, "GLOBE")) return "GLOBO";
  if (hasToken(identity, "LANTERN") || hasToken(identity, "LANTERNA")) return "LANTERN";
  if (hasToken(identity, "UPLIGHT") || hasToken(identity, "INGROUND") || hasToken(identity, "INCASSO")) return "UPLIGHT";
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
  const hybrid = Boolean(product.hybrid);
  return {
    ...product,
    model: product.model || product.name || "",
    productCategory,
    compatibleExistingCategories,
    replacementStrategies,
    efficiency: Number(product.efficiency || 0) || (Number(product.wattage) > 0 ? Number(product.lumen || 0) / Number(product.wattage) : 0),
    cctCriCode: String(product.cctCriCode ?? product.cctCri ?? "").trim(),
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
    hybrid,
    pvWp: Math.max(0, numeric(product.pvWp)),
    batteryWh: Math.max(0, numeric(product.batteryWh)),
    usableBatteryWh: Math.max(0, numeric(product.usableBatteryWh)),
    solarModeW: Math.max(0, numeric(product.solarModeW)),
    weightKg: Math.max(0, numeric(product.weightKg)),
    pvEfficiencyPercent: Math.max(0, numeric(product.pvEfficiencyPercent)),
    batteryRoundtripEfficiencyPercent: Math.max(0, numeric(product.batteryRoundtripEfficiencyPercent || 90)),
    mppt: hybrid ? true : Boolean(product.mppt),
  };
}

export function isCatalogueProductCompatible(product, existingCategory = "OTHER", replacementRequirement = "UNKNOWN") {
  const normalized = normalizeCatalogueProduct(product);
  const existing = normalizeProductCategory(existingCategory);
  const requirement = normalizeReplacementStrategy(replacementRequirement);
  const knownFamily = normalized.productCategory !== "OTHER";

  let categoryOk;
  if (normalized.compatibleExistingCategories.length > 0) {
    if (normalized.compatibleExistingCategories.includes(existing)) {
      categoryOk = true;
    } else if (normalized.compatibleExistingCategories.includes("OTHER")) {
      categoryOk = existing === "OTHER" || !knownFamily || normalized.productCategory === existing;
    } else {
      categoryOk = false;
    }
  } else {
    categoryOk = existing === "OTHER" || !knownFamily || normalized.productCategory === existing;
  }

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
