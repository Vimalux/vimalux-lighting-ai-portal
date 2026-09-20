import { partnerEquipmentPricingRows } from "./partnerEquipment.js";

const safe = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const positive = (value) => Math.max(0, safe(value));

function productLabel(product = {}) {
  const brand = String(product.brand || "").trim();
  const name = String(product.name || product.model || product.id || "Prodotto").trim();
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

function smartProduct(project, id) {
  return (project?.catalogue?.smart || []).find((item) => item?.id === id) || {};
}

function aggregateLuminaireRows(calculated) {
  const map = new Map();
  (calculated?.groupRows || []).forEach((row) => {
    if (!row?.upgradeSelected) return;
    const quantity = positive(row.quantity);
    const total = positive(row.salesTotal);
    if (!quantity || !total) return;
    const unitPrice = total / quantity;
    const product = row.product || {};
    const wattage = positive(row.configuredLedWattage || product.wattage);
    const name = productLabel(product);
    const type = product.hybrid ? "Hybrid" : "LED";
    const key = [product.id || name, wattage, unitPrice.toFixed(6), type].join("|");
    const existing = map.get(key) || { category: "luminaire", name, type, wattage, quantity: 0, unit: "pz", unitPrice, total: 0 };
    existing.quantity += quantity;
    existing.total += total;
    map.set(key, existing);
  });
  return [...map.values()].sort((a, b) => a.type.localeCompare(b.type) || a.wattage - b.wattage || a.name.localeCompare(b.name));
}

function componentRow(name, quantity, total, unit = "pz") {
  const qty = positive(quantity);
  const amount = positive(total);
  if (!qty || !amount) return null;
  return { category: "component", name, quantity: qty, unit, unitPrice: amount / qty, total: amount };
}

export function buildCustomerCapexDetail(project, calculated, tolerance = 1) {
  const luminaires = aggregateLuminaireRows(calculated);
  const components = [];
  const solution = project?.solution || {};

  const lcu = smartProduct(project, solution.lcuProductId);
  const gateway = smartProduct(project, solution.gatewayProductId);
  const antenna = smartProduct(project, solution.antennaProductId);
  const meter = smartProduct(project, solution.meterProductId);

  const push = (row) => { if (row) components.push(row); };
  push(componentRow(productLabel(lcu) || "LCU", calculated?.lcuQuantity, calculated?.smartHardwareCapex));
  push(componentRow("Implementazione / configurazione Smart Lighting", calculated?.lcuQuantity, calculated?.implementationCapex));
  push(componentRow(productLabel(gateway) || "Gateway", calculated?.hardware?.gatewayQty ?? solution.gatewayQuantity, calculated?.gatewayCapex));
  push(componentRow(productLabel(antenna) || "Antenna", calculated?.hardware?.antennaQty ?? solution.antennaQuantity, calculated?.antennaCapex));
  push(componentRow(productLabel(meter) || "Energy meter", calculated?.hardware?.meterQty ?? solution.meterQuantity, calculated?.meterCapex));

  const freight = positive(calculated?.freight);
  if (freight > 0) components.push({ category: "logistics", name: "Trasporto / logistica", quantity: 1, unit: "lotto", unitPrice: freight, total: freight });

  partnerEquipmentPricingRows(project)
    .filter((row) => row.costType === "capex")
    .forEach((row) => {
      const quantity = positive(row.q);
      const total = positive(row.total);
      if (!quantity || !total) return;
      components.push({
        category: "partner_equipment",
        name: String(row.label || "Componente partner")
          .replace(/^Partner\s*·\s*/i, "")
          .replace(/\s*·\s*implementation$/i, " · Implementazione"),
        quantity,
        unit: "pz",
        unitPrice: total / quantity,
        total,
      });
    });

  (project?.additionalCosts || []).forEach((item) => {
    if (item?.virtualPartnerEquipment) return;
    if (String(item?.costType || "capex").toLowerCase() !== "capex") return;
    const quantity = positive(item?.quantity);
    const unitPrice = positive(item?.unitSalesPrice);
    const total = quantity * unitPrice;
    if (!quantity || !total) return;
    components.push({
      category: "additional",
      name: String(item?.description || item?.note || "Voce CAPEX aggiuntiva").trim(),
      quantity,
      unit: String(item?.unit || "").trim(),
      unitPrice,
      total,
    });
  });

  const luminaireSubtotal = luminaires.reduce((sum, row) => sum + row.total, 0);
  const componentSubtotalBeforeAdjustment = components.reduce((sum, row) => sum + row.total, 0);
  const totalCapex = positive(calculated?.totalCapex);
  const itemizedBeforeAdjustment = luminaireSubtotal + componentSubtotalBeforeAdjustment;
  const adjustment = totalCapex - itemizedBeforeAdjustment;

  if (Math.abs(adjustment) > tolerance) {
    components.push({
      category: "adjustment",
      name: adjustment < 0 ? "Differenza di riconciliazione / sconto CAPEX ufficiale" : "Differenza di riconciliazione CAPEX ufficiale",
      quantity: 1,
      unit: "lotto",
      unitPrice: adjustment,
      total: adjustment,
    });
  }

  const componentSubtotal = components.reduce((sum, row) => sum + row.total, 0);
  const reconciledTotal = luminaireSubtotal + componentSubtotal;
  return {
    luminaires,
    components,
    luminaireSubtotal,
    itemizedBeforeAdjustment,
    componentSubtotal,
    totalCapex,
    reconciledTotal,
    adjustment: Math.abs(adjustment) > tolerance ? adjustment : 0,
    reconciles: Math.abs(reconciledTotal - totalCapex) <= tolerance,
    totalLuminaireQuantity: luminaires.reduce((sum, row) => sum + row.quantity, 0),
    hybridLuminaireQuantity: luminaires.filter((row) => row.type === "Hybrid").reduce((sum, row) => sum + row.quantity, 0),
  };
}
