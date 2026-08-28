const AGENT_EDITABLE_FIELDS = [
  "id",
  "description",
  "category",
  "costType",
  "quantity",
  "unit",
  "unitSalesPrice",
  "note",
];

const copyAgentFields = (item = {}) =>
  Object.fromEntries(
    AGENT_EDITABLE_FIELDS
      .filter((key) => Object.hasOwn(item, key))
      .map((key) => [key, item[key]]),
  );

export const sanitizeAgentAdditionalCosts = (existingRows = [], incomingRows = []) => {
  const existingById = new Map(
    existingRows.filter((item) => item?.id).map((item) => [item.id, item]),
  );

  return incomingRows.map((incoming, index) => {
    const existing = incoming?.id
      ? existingById.get(incoming.id)
      : existingRows[index]?.id
        ? undefined
        : existingRows[index];
    return {
      ...(existing || {}),
      ...copyAgentFields(incoming),
      unitCost: existing?.unitCost ?? 0,
    };
  });
};

export const isAgentViewAllowed = (view, allowedViews) => allowedViews.has(view);
