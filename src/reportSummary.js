const text = (value) => String(value ?? "").trim();

export function aggregateReplacementRows(groupRows = []) {
  const aggregated = new Map();

  groupRows.forEach((group) => {
    const product = group.product || {};
    const technology = text(group.technology) || "-";
    const existingWattage = Number(group.existingWattage) || 0;
    const productName = text(product.name) || "-";
    const configuredLedWattage = Number(group.configuredLedWattage) || Number(product.wattage) || 0;
    const productKey = text(product.id) || `${productName}|${Number(product.wattage) || 0}`;
    const key = `${technology}|${existingWattage}|${productKey}|${configuredLedWattage}`;
    const quantity = Number(group.quantity) || 0;
    const current = aggregated.get(key);

    if (current) current.quantity += quantity;
    else aggregated.set(key, { technology, existingWattage, quantity, productName, configuredLedWattage });
  });

  return [...aggregated.values()].sort((a, b) =>
    a.technology.localeCompare(b.technology) ||
    a.existingWattage - b.existingWattage ||
    a.productName.localeCompare(b.productName),
  );
}
