import React from "react";
import { catalogueWarranty, projectWarranty } from "./warranty.js";

export default function WarrantySelector({ p, update }) {
  const it = p.language === "it";
  const config = catalogueWarranty(p.catalogue);
  const warranty = projectWarranty(p);
  const formatPct = (value) => Number(value || 0).toLocaleString(it ? "it-IT" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = (value) => {
    const years = Math.max(1, Math.min(30, Math.round(Number(value) || config.standardYears)));
    update(["solution", "warrantyYears"], years);
    if (years > config.standardYears) update(["solution", "warrantyUpliftPercentSnapshot"], config.upliftPercent);
  };
  return <div className="warranty-selector">
    <label>
      <span>{it ? "Garanzia apparecchi" : "Luminaire warranty"}</span>
      <input type="number" min="1" max="30" step="1" value={warranty.selectedYears} onChange={(event) => change(event.target.value)} />
    </label>
    <small>{it
      ? `Periodo liberamente modificabile. Oltre la garanzia standard di ${config.standardYears} anni viene applicata la maggiorazione configurata del ${formatPct(config.upliftPercent)}%. Il valore viene salvato nel Business Case.`
      : `Freely editable term. Above the ${config.standardYears}-year standard warranty, the configured ${formatPct(config.upliftPercent)}% uplift is applied. The value is saved with the Business Case.`}</small>
  </div>;
}
