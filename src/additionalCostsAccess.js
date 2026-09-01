export const AGENT_ADDITIONAL_COST_MARKUP_PERCENT = 15;

const AGENT_EDITABLE_FIELDS = [
  "id",
  "description",
  "category",
  "costType",
  "quantity",
  "unit",
  "unitCost",
  "note",
];

const copyAgentFields = (item = {}) =>
  Object.fromEntries(
    AGENT_EDITABLE_FIELDS
      .filter((key) => Object.hasOwn(item, key))
      .map((key) => [key, item[key]]),
  );

const priceFromSupplierCost = (unitCost, markupPercent = AGENT_ADDITIONAL_COST_MARKUP_PERCENT) => {
  const cost = Number(unitCost);
  const markup = Number(markupPercent);
  if (!Number.isFinite(cost) || cost < 0) return 0;
  const safeMarkup = Number.isFinite(markup) ? Math.max(0, markup) : AGENT_ADDITIONAL_COST_MARKUP_PERCENT;
  return Math.round(cost * (1 + safeMarkup / 100) * 100) / 100;
};

export const sanitizeAgentAdditionalCosts = (
  existingRows = [],
  incomingRows = [],
  markupPercent = AGENT_ADDITIONAL_COST_MARKUP_PERCENT,
) => {
  const existingById = new Map(
    existingRows.filter((item) => item?.id).map((item) => [item.id, item]),
  );

  return incomingRows.map((incoming, index) => {
    const existing = incoming?.id
      ? existingById.get(incoming.id)
      : existingRows[index]?.id
        ? undefined
        : existingRows[index];
    const copied = copyAgentFields(incoming);
    const nextUnitCost = Object.hasOwn(copied, "unitCost")
      ? copied.unitCost
      : existing?.unitCost ?? 0;
    const supplierCostChanged = !existing || Number(nextUnitCost) !== Number(existing.unitCost ?? 0);

    return {
      ...(existing || {}),
      ...copied,
      unitCost: nextUnitCost,
      unitSalesPrice: supplierCostChanged
        ? priceFromSupplierCost(nextUnitCost, markupPercent)
        : existing?.unitSalesPrice ?? priceFromSupplierCost(nextUnitCost, markupPercent),
    };
  });
};

export const isAgentViewAllowed = (view, allowedViews) => allowedViews.has(view);
