const numberValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  let text = String(value).trim().replace(/\s/g, "");
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0)
    text = comma > dot
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  else if (comma >= 0) text = text.replace(/\./g, "").replace(",", ".");
  return Number.isFinite(Number(text)) ? Number(text) : 0;
};

const positive = (value) => Math.max(0, numberValue(value));

export const ADDITIONAL_COST_TYPES = ["capex", "opex_annual"];
export const ADDITIONAL_COST_CATEGORIES = [
  "materiale",
  "lavoro",
  "opere_civili",
  "servizi",
  "altro",
];

export function normalizeAdditionalCost(item = {}) {
  return {
    id: String(item.id || ""),
    description: String(item.description || ""),
    category: ADDITIONAL_COST_CATEGORIES.includes(item.category)
      ? item.category
      : "altro",
    costType: ADDITIONAL_COST_TYPES.includes(item.costType)
      ? item.costType
      : "capex",
    quantity: positive(item.quantity),
    unit: String(item.unit || "pz"),
    unitCost: positive(item.unitCost),
    unitSalesPrice: positive(item.unitSalesPrice),
    note: String(item.note || ""),
  };
}

export function calculateAdditionalCosts(items = []) {
  const rows = (Array.isArray(items) ? items : []).map((raw) => {
    const item = normalizeAdditionalCost(raw);
    const costTotal = item.quantity * item.unitCost;
    const salesTotal = item.quantity * item.unitSalesPrice;
    return {
      ...item,
      costTotal,
      salesTotal,
      margin: salesTotal - costTotal,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      if (row.costType === "opex_annual") {
        acc.annualOpexCost += row.costTotal;
        acc.annualOpexSales += row.salesTotal;
      } else {
        acc.capexCost += row.costTotal;
        acc.capexSales += row.salesTotal;
      }
      return acc;
    },
    {
      capexCost: 0,
      capexSales: 0,
      annualOpexCost: 0,
      annualOpexSales: 0,
    },
  );

  return {
    rows,
    ...totals,
    capexMargin: totals.capexSales - totals.capexCost,
    annualOpexMargin: totals.annualOpexSales - totals.annualOpexCost,
  };
}
