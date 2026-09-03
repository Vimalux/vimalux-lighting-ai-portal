const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const text = (value) => String(value || "").trim();
const unassigned = (language) => language === "it" ? "Fornitore non assegnato" : "Supplier not assigned";

export function buildProcurementRows(project = {}) {
  const rows = [];
  const ledById = new Map((project.catalogue?.led || []).map((item) => [String(item.id), item]));
  const smartById = new Map((project.catalogue?.smart || []).map((item) => [String(item.id), item]));
  const assignments = project.procurement?.assignments || {};

  const push = (row) => {
    const quantity = numberValue(row.quantity);
    if (!(quantity > 0)) return;
    const key = String(row.key);
    const supplier = text(assignments[key]) || text(row.supplier);
    rows.push({
      ...row,
      key,
      supplier,
      quantity,
      unitCost: numberValue(row.unitCost),
      totalCost: quantity * numberValue(row.unitCost),
    });
  };

  (project.groups || []).forEach((group, index) => {
    if (group?.upgradeSelected === false || !group?.proposedProductId) return;
    const product = ledById.get(String(group.proposedProductId));
    if (!product) return;
    push({
      key: `led:${product.id}:${index}`,
      source: "LED",
      productId: product.id,
      supplier: product.supplier,
      supplierSku: product.supplierSku,
      brand: product.brand,
      description: product.model || product.name || product.id,
      quantity: group.quantity,
      unit: "pz",
      unitCost: product.costPrice,
    });
  });

  const upgradedQuantity = (project.groups || []).reduce((sum, group) => group?.upgradeSelected === false ? sum : sum + numberValue(group?.quantity), 0);
  const solution = project.solution || {};
  const smartItems = [
    ["lcuProductId", upgradedQuantity, "LCU"],
    ["gatewayProductId", solution.gatewayQuantity, "Gateway"],
    ["antennaProductId", solution.antennaQuantity, "Antenna"],
    ["meterProductId", solution.meterQuantity, "Energy Meter"],
  ];
  if (solution.smartEnabled !== false) {
    smartItems.forEach(([field, quantity, source]) => {
      const id = solution[field];
      if (!id) return;
      const product = smartById.get(String(id));
      if (!product) return;
      push({
        key: `smart:${field}:${product.id}`,
        source,
        productId: product.id,
        supplier: product.supplier,
        supplierSku: product.supplierSku,
        brand: product.brand,
        description: product.name || product.id,
        quantity,
        unit: "pz",
        unitCost: product.costPrice,
      });
    });
  }

  (project.additionalCosts || []).forEach((item, index) => {
    push({
      key: `cost:${item.id || index}`,
      source: item.category || "Project cost",
      productId: item.id || "",
      supplier: item.supplier,
      supplierSku: item.supplierSku,
      brand: "",
      description: item.description || "Project cost",
      quantity: item.quantity,
      unit: item.unit || "pz",
      unitCost: item.unitCost,
    });
  });

  return rows;
}

export function groupProcurementBySupplier(project = {}) {
  const rows = buildProcurementRows(project);
  const language = project.language || "it";
  const groups = new Map();
  rows.forEach((row) => {
    const supplier = row.supplier || unassigned(language);
    if (!groups.has(supplier)) groups.set(supplier, []);
    groups.get(supplier).push(row);
  });
  return [...groups.entries()].map(([supplier, items]) => ({
    supplier,
    assigned: supplier !== unassigned(language),
    items,
    totalCost: items.reduce((sum, item) => sum + item.totalCost, 0),
  }));
}

export function procurementCsv(group, project = {}) {
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const header = ["Supplier", "Source", "Brand", "Product / Work", "Supplier SKU", "Quantity", "Unit", "Unit cost", "Total cost", "Project", "Business Case"];
  const projectName = project.project?.name || project.name || "";
  const businessCase = project.project?.businessCaseId || "";
  const lines = group.items.map((item) => [
    group.supplier, item.source, item.brand, item.description, item.supplierSku || "", item.quantity, item.unit, item.unitCost, item.totalCost, projectName, businessCase,
  ].map(quote).join(";"));
  return [header.map(quote).join(";"), ...lines].join("\n");
}
