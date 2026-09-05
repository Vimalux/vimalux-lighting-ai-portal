const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const uniq = (values) => [...new Set(values)];

export function parseVariantNumbers(value) {
  return uniq(String(value || "")
    .split(/[,;|\s]+/)
    .map((item) => n(String(item).replace(",", ".")))
    .filter((item) => item > 0));
}

export function parseVariantTokens(value) {
  return uniq(String(value || "")
    .split(/[,;|]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean));
}

export function cctCode(kelvin, cri = 70) {
  const k = Math.round(n(kelvin));
  const r = Math.round(n(cri) || 70);
  if (!k) return "";
  return `${Math.round(r / 10)}${Math.round(k / 100)}`;
}

export function parseCctEfficiencies(value, fallbackEfficiency = 0) {
  const result = [];
  String(value || "").split(/[,;|]+/).forEach((item) => {
    const [cctRaw, efficiencyRaw] = item.split(/[:=]/).map((part) => String(part || "").trim());
    const cct = n(cctRaw);
    if (!cct) return;
    result.push({ cct, efficiency: n(efficiencyRaw) || n(fallbackEfficiency) });
  });
  return result.length ? result : [];
}

export function buildVariantModel(baseCode, wattage, cct, optic, controller, cri = 70) {
  return [String(baseCode || "").trim(), `${Math.round(n(wattage))}W`, cctCode(cct, cri), optic, controller]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("-");
}

const inheritedFields = [
  "brand", "supplier", "productCategory", "compatibleExistingCategories", "replacementStrategies",
  "ip", "ik", "protectionClass", "lifetime", "zhaga", "d4iDriver", "photometryUrl", "techSheetUrl",
  "hybrid", "pvWp", "batteryWh", "usableBatteryWh", "solarModeW", "weightKg", "pvEfficiencyPercent",
  "batteryRoundtripEfficiencyPercent", "mppt",
];

export function generateCatalogueVariants(master = {}, config = {}, existingProducts = [], makeId = () => `variant-${Date.now()}`) {
  const wattages = parseVariantNumbers(config.wattages);
  const ccts = parseCctEfficiencies(config.cctEfficiencies, master.efficiency || (n(master.wattage) > 0 ? n(master.lumen) / n(master.wattage) : 0));
  const optics = parseVariantTokens(config.optics);
  const controllers = parseVariantTokens(config.controllers);
  const baseCode = String(config.baseCode || master.variantBaseCode || master.model || master.name || "LED").trim();
  const cri = n(config.cri) || 70;
  if (!wattages.length) throw new Error("At least one wattage is required.");
  if (!ccts.length) throw new Error("At least one CCT with lm/W is required, e.g. 3000:155, 4000:165.");
  const opticValues = optics.length ? optics : [""];
  const controllerValues = controllers.length ? controllers : [""];
  const currentByKey = new Map(existingProducts.filter((item) => item?.variantParentId === master.id && item?.variantKey).map((item) => [item.variantKey, item]));
  const variants = [];

  wattages.forEach((wattage) => ccts.forEach(({ cct, efficiency }) => opticValues.forEach((optic) => controllerValues.forEach((controller) => {
    const key = `${wattage}|${cct}|${optic}|${controller}`;
    const current = currentByKey.get(key) || {};
    const model = buildVariantModel(baseCode, wattage, cct, optic, controller, cri);
    const inherited = Object.fromEntries(inheritedFields.map((field) => [field, master[field]]));
    variants.push({
      ...current,
      ...inherited,
      id: current.id || makeId(),
      variantParentId: master.id,
      variantKey: key,
      variantGenerated: true,
      variantBaseCode: baseCode,
      name: model,
      model,
      wattage,
      cct,
      cctCriCode: cctCode(cct, cri),
      cri,
      optic,
      controller,
      efficiency,
      lumen: Math.round(wattage * efficiency),
      supplierSku: current.supplierSku || "",
      costPrice: n(current.costPrice) || n(master.costPrice),
      salesPrice: n(current.salesPrice) || n(master.salesPrice),
      active: current.active !== false,
    });
  }))));

  return variants;
}

export function mergeGeneratedVariants(products = [], master = {}, variants = []) {
  const newByKey = new Map(variants.map((item) => [item.variantKey, item]));
  const untouched = [];
  const retainedHistorical = [];

  products.forEach((item) => {
    if (item?.variantParentId !== master.id) {
      untouched.push(item);
      return;
    }
    if (!newByKey.has(item.variantKey)) retainedHistorical.push({ ...item, active: false, variantRetired: true });
  });

  return [...untouched, ...retainedHistorical, ...variants];
}
