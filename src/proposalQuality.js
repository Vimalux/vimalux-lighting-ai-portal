const normalizeCategory = (value) => {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (["STRADALE", "ROAD"].includes(text)) return "STREET";
  if (["ARREDO URBANO", "ARREDO_URBANO", "DECORATIVE"].includes(text)) return "URBAN";
  if (["PROIETTORE", "PROJECTOR"].includes(text)) return "FLOODLIGHT";
  return text;
};

export function validateProposalQuality(project) {
  const products = new Map((project?.catalogue?.led || []).map((product) => [product.id, product]));
  const issues = [];

  for (const group of project?.groups || []) {
    if (group?.upgradeSelected === false || Number(group?.quantity || 0) <= 0) continue;
    const productId = String(group?.proposedProductId || "").trim();
    const category = normalizeCategory(group?.existingCategory || group?.luminaireCategory);
    if (!productId) {
      issues.push({ type: "missing_product", group: group?.name || "-", category, productId: "" });
      continue;
    }
    const product = products.get(productId);
    if (!product) {
      issues.push({ type: "unknown_product", group: group?.name || "-", category, productId });
      continue;
    }
    const compatible = (product.compatibleExistingCategories || []).map(normalizeCategory).filter(Boolean);
    const productCategory = normalizeCategory(product.productCategory);
    const allowed = compatible.length ? compatible.includes(category) : productCategory === category;
    if (category && !allowed) {
      issues.push({
        type: "incompatible_product",
        group: group?.name || "-",
        category,
        productId,
        productCategory,
        compatible,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function qualityGateMessage(validation, language = "it") {
  if (validation?.ok) return "";
  const it = language === "it";
  const first = (validation?.issues || []).slice(0, 3).map((issue) => {
    const product = issue.productId || (it ? "nessun prodotto" : "no product");
    return `${issue.group}: ${issue.category || "?"} → ${product}`;
  });
  const suffix = (validation?.issues?.length || 0) > 3 ? ` (+${validation.issues.length - 3})` : "";
  return it
    ? `Proposta bloccata: ${validation.issues.length} assegnazioni tecniche non valide. Correggere prima di generare il PDF. ${first.join("; ")}${suffix}`
    : `Proposal blocked: ${validation.issues.length} invalid technical assignments. Correct them before generating the PDF. ${first.join("; ")}${suffix}`;
}
