const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const norm = (value) => String(value || "").trim().toUpperCase();

export function smartProductPartner(product = {}) {
  return [product.cmsPartner, product.vendor, product.supplier]
    .map(norm)
    .find(Boolean) || "";
}

export function availablePartnerEquipment(project = {}, partner = "") {
  const selectedPartner = norm(partner);
  return (project.catalogue?.smart || []).filter((product) =>
    product?.active !== false
    && String(product?.type || "").trim().toLowerCase() === "other"
    && (!selectedPartner || smartProductPartner(product) === selectedPartner)
  );
}

export function selectedPartnerEquipment(project = {}) {
  const byId = new Map((project.catalogue?.smart || []).map((product) => [String(product.id), product]));
  return (project.solution?.partnerEquipment || [])
    .map((selection, index) => {
      const product = byId.get(String(selection?.productId || ""));
      const quantity = num(selection?.quantity);
      if (!product || product.active === false || quantity <= 0) return null;
      return { key: selection.id || `${product.id}:${index}`, product, quantity };
    })
    .filter(Boolean);
}

export function partnerEquipmentAdditionalCosts(project = {}) {
  const rows = [];
  selectedPartnerEquipment(project).forEach(({ key, product, quantity }) => {
    const capexCost = num(product.costPrice) + num(product.implementationCost);
    const capexSales = num(product.salesPrice) + num(product.implementationSalesPrice);
    if (capexCost > 0 || capexSales > 0) {
      rows.push({
        id: `partner-equipment-capex:${key}`,
        description: product.name || product.id,
        category: "materiale",
        costType: "capex",
        quantity,
        unit: "pz",
        unitCost: capexCost,
        unitSalesPrice: capexSales,
        note: `Catalogue partner equipment · ${product.supplier || product.cmsPartner || product.vendor || ""}`,
        virtualPartnerEquipment: true,
      });
    }
    const annualCost = num(product.annualCost);
    const annualSales = num(product.annualSalesPrice);
    if (annualCost > 0 || annualSales > 0) {
      rows.push({
        id: `partner-equipment-opex:${key}`,
        description: `${product.name || product.id} · annual service`,
        category: "servizi",
        costType: "opex_annual",
        quantity,
        unit: "anno",
        unitCost: annualCost,
        unitSalesPrice: annualSales,
        note: `Catalogue partner equipment annual service · ${product.supplier || product.cmsPartner || product.vendor || ""}`,
        virtualPartnerEquipment: true,
      });
    }
  });
  return rows;
}

export function projectWithPartnerEquipmentCosts(project = {}) {
  const generated = partnerEquipmentAdditionalCosts(project);
  if (!generated.length) return project;
  return {
    ...project,
    additionalCosts: [...(project.additionalCosts || []), ...generated],
  };
}
