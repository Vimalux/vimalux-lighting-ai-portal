import { calculateAdditionalCosts } from "./additionalCosts.js";

// The Solution screen is a customer-price summary for Admin and Agent. Never
// expose unitCost, costTotal, or internal margin through these summary rows.
export function solutionAdditionalCostRows(project, type) {
  return calculateAdditionalCosts(project?.additionalCosts).rows
    .filter((row) => row.costType === type && row.salesTotal > 0)
    .map(({ id, description, quantity, unit, unitSalesPrice, salesTotal }) => ({
      id,
      description: description.trim() || "Costo aggiuntivo",
      quantity,
      unit,
      unitSalesPrice,
      salesTotal,
    }));
}
