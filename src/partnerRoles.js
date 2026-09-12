// Role describes the service; type describes hardware; supplier is the seller.
// Legacy inference is read-only: saved projects and catalogue identifiers stay intact.
export const PARTNER_ROLES = {
  CMS: "CMS / Lighting Control",
  ADAPTIVE_DIMMING: "Adaptive Dimming",
  HYBRID_LIGHTING: "Hybrid Lighting",
  GENERAL: "General / Other",
};
export const normalizePartner = (value) => String(value || "").trim().toUpperCase();
export const partnerDisplayText = (value) => String(value ?? "").replace(/PowerAiD/gi, "Adaptive Dimming");
const list = (value) => Array.isArray(value) ? value : value ? [value] : [];
const normalizeRole = (value) => {
  const role = normalizePartner(value).replace(/[ /-]+/g, "_");
  return ({ LIGHTING_CONTROL: "CMS", CMS_LIGHTING_CONTROL: "CMS", OTHER: "GENERAL", GENERAL_OTHER: "GENERAL" })[role] || role;
};
export function productPartner(product = {}, role = "CMS") {
  return [product.partnerName, role === "ADAPTIVE_DIMMING" ? product.adaptiveDimmingPartner : product.cmsPartner,
    product.vendor, product.supplier, product.brand].map(normalizePartner).find(Boolean) || "";
}
export function productRoles(product = {}) {
  const explicit = [...list(product.partnerRoles), ...list(product.partnerRole)].map(normalizeRole).filter(Boolean);
  if (explicit.length) return [...new Set(explicit.filter((role) => role in PARTNER_ROLES))];
  // Existing FELICITY catalogue entries predate roles. Never infer CMS for them.
  if ([product.partnerName, product.cmsPartner, product.vendor, product.supplier, product.brand].some((name) => normalizePartner(name) === "FELICITY")) return ["ADAPTIVE_DIMMING"];
  if (["LCU", "ZHAGA", "GATEWAY", "ANTENNA", "ENERGY METER", "CMS"].includes(normalizePartner(product.type))) return ["CMS"];
  return ["GENERAL"];
}
export function productSupportsPartner(product, partner, role) {
  const name = normalizePartner(partner);
  return Boolean(product && name && product.active !== false && productRoles(product).includes(role)
    && (productPartner(product, role) === name || list(product.compatiblePartners).map(normalizePartner).includes(name)));
}
export function selectedEquipmentRole(selection, product) {
  const roles = productRoles(product);
  return roles.includes(selection.partnerRole) ? selection.partnerRole : roles[0];
}
export function partnerOptions(source = [], role) {
  const projects = Array.isArray(source) ? source : [source];
  return [...new Set(projects.flatMap((project) => (project?.catalogue?.smart || [])
    .filter((item) => item.active !== false && productRoles(item).includes(role))
    .map((item) => productPartner(item, role))).filter(Boolean))].sort();
}
export function availableCmsProducts(project, partner, type) {
  return (project?.catalogue?.smart || []).filter((item) =>
    (normalizePartner(item.type) === normalizePartner(type) || (type === "LCU" && normalizePartner(item.type) === "ZHAGA"))
    && productSupportsPartner(item, partner, "CMS"));
}
export function changeCmsPartner(project, partner) {
  const solution = { ...project.solution, cmsPartner: normalizePartner(partner) };
  // Preserve compatible hardware, quantities, and all other role selections.
  for (const field of ["lcuProductId", "gatewayProductId", "antennaProductId", "meterProductId"]) {
    const product = (project.catalogue?.smart || []).find((item) => item.id === solution[field]);
    if (solution[field] && !productSupportsPartner(product, partner, "CMS")) solution[field] = "";
  }
  return solution;
}
export function changeAdaptiveDimmingPartner(project, partner) {
  return { ...project.solution, adaptiveDimmingPartner: normalizePartner(partner),
    partnerEquipment: (project.solution?.partnerEquipment || []).filter((row) => {
      const product = (project.catalogue?.smart || []).find((item) => item.id === row.productId);
      const adaptive = row.partnerRole === "ADAPTIVE_DIMMING" || (product && productRoles(product).includes("ADAPTIVE_DIMMING"));
      return !adaptive || productSupportsPartner(product, partner, "ADAPTIVE_DIMMING");
    }),
  };
}
