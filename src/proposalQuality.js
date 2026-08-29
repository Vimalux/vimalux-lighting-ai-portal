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
      issues.push({ type: "missing_product", severity: "blocker", group: group?.name || "-", category, productId: "" });
      continue;
    }
    const product = products.get(productId);
    if (!product) {
      issues.push({ type: "unknown_product", severity: "blocker", group: group?.name || "-", category, productId });
      continue;
    }
    const compatible = (product.compatibleExistingCategories || []).map(normalizeCategory).filter(Boolean);
    const productCategory = normalizeCategory(product.productCategory);
    const allowed = compatible.length ? compatible.includes(category) : productCategory === category;
    if (category && !allowed) {
      issues.push({
        type: "incompatible_product",
        severity: "warning",
        group: group?.name || "-",
        category,
        productId,
        productCategory,
        compatible,
      });
    }
  }

  const blockers = issues.filter((issue) => issue.severity === "blocker");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ok: blockers.length === 0, issues, blockers, warnings };
}

export function qualityGateMessage(validation, language = "it") {
  const blockers = validation?.blockers || (validation?.issues || []).filter((issue) => issue.severity !== "warning");
  if (!blockers.length) return "";
  const it = language === "it";
  const first = blockers.slice(0, 3).map((issue) => {
    const product = issue.productId || (it ? "nessun prodotto" : "no product");
    return `${issue.group}: ${issue.category || "?"} → ${product}`;
  });
  const suffix = blockers.length > 3 ? ` (+${blockers.length - 3})` : "";
  return it
    ? `Proposta bloccata: ${blockers.length} assegnazioni tecniche incomplete. Assegnare un prodotto valido prima di generare il PDF. ${first.join("; ")}${suffix}`
    : `Proposal blocked: ${blockers.length} technical assignments are incomplete. Assign a valid product before generating the PDF. ${first.join("; ")}${suffix}`;
}

export function qualityWarningMessage(validation, language = "it") {
  const warnings = validation?.warnings || (validation?.issues || []).filter((issue) => issue.severity === "warning");
  if (!warnings.length) return "";
  const it = language === "it";
  const first = warnings.slice(0, 3).map((issue) => `${issue.group}: ${issue.category || "?"} → ${issue.productId || "?"}`);
  const suffix = warnings.length > 3 ? ` (+${warnings.length - 3})` : "";
  return it
    ? `Avviso tecnico: ${warnings.length} assegnazioni non corrispondono alla compatibilità catalogo. Il PDF può essere generato; verificare la selezione in Planner. ${first.join("; ")}${suffix}`
    : `Technical warning: ${warnings.length} assignments do not match catalogue compatibility. The PDF can still be generated; verify the selection in Planner. ${first.join("; ")}${suffix}`;
}
