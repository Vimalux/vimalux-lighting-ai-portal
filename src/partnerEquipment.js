import { productPartner, productRoles } from "./partnerRoles.js";

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const norm = (value) => String(value || "").trim().toUpperCase();
const projectPrice = (project, product, key) => {
  const override = project?.pricing?.overrides?.[product?.id]?.[key];
  return override === undefined || override === null || override === "" ? num(product?.[key]) : num(override);
};

export function smartProductPartner(product = {}) {
  return productPartner(product, productRoles(product)[0]);
}

export function availablePartnerEquipment(project = {}, partner = "") {
  const selectedPartner = norm(partner);
  return (project.catalogue?.smart || []).filter((product) =>
    product?.active !== false
    && productRoles(product).some((role) => role !== "CMS")
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

export function partnerEquipmentPricingRows(project = {}) {
  const rows = [];
  selectedPartnerEquipment(project).forEach(({ key, product, quantity }) => {
    const supplier = product.supplier || product.cmsPartner || product.vendor || "";
    const sku = product.supplierSku || product.sku || "";
    const suffix = [supplier, sku].filter(Boolean).join(" · ");
    const baseLabel = `Partner · ${product.name || product.id}${suffix ? ` · ${suffix}` : ""}`;
    const addRow = (kind, label, salesKey, costKey, costType) => {
      const cost = num(product[costKey]);
      const cat = num(product[salesKey]);
      const sale = projectPrice(project, product, salesKey);
      if (cost <= 0 && cat <= 0 && sale <= 0) return;
      rows.push({
        id: `partner-equipment-${kind}:${key}`,
        label,
        q: quantity,
        productId: product.id,
        key: salesKey,
        cost,
        cat,
        total: quantity * sale,
        costType,
        partnerEquipment: true,
      });
    };
    addRow("hardware", baseLabel, "salesPrice", "costPrice", "capex");
    addRow("implementation", `${baseLabel} · implementation`, "implementationSalesPrice", "implementationCost", "capex");
    addRow("annual", `${baseLabel} · annual service`, "annualSalesPrice", "annualCost", "opex_annual");
  });
  return rows;
}

export function partnerEquipmentAdditionalCosts(project = {}) {
  const rows = [];
  selectedPartnerEquipment(project).forEach(({ key, product, quantity }) => {
    const capexCost = num(product.costPrice) + num(product.implementationCost);
    const capexSales = projectPrice(project, product, "salesPrice") + projectPrice(project, product, "implementationSalesPrice");
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
    const annualSales = projectPrice(project, product, "annualSalesPrice");
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
  const stored = project.additionalCosts || [];
  const original = stored.filter((row) => !row.virtualPartnerEquipment);
  if (!generated.length && original.length === stored.length) return project;
  return {
    ...project,
    additionalCosts: [...original, ...generated],
  };
}
