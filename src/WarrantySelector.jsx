import React from "react";
import { catalogueWarranty, projectWarranty } from "./warranty.js";

export default function WarrantySelector({ p, update }) {
  const it = p.language === "it";
  const config = catalogueWarranty(p.catalogue);
  const warranty = projectWarranty(p);
  const formatPct = (value) => Number(value || 0).toLocaleString(it ? "it-IT" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = (value) => {
    const years = Number(value);
    update(["solution", "warrantyYears"], years);
    if (years === config.extendedYears) update(["solution", "warrantyUpliftPercentSnapshot"], config.upliftPercent);
  };
  return <div className="warranty-selector">
    <label>
      <span>{it ? "Garanzia apparecchi" : "Luminaire warranty"}</span>
      <select value={warranty.selectedYears} onChange={(event) => change(event.target.value)}>
        <option value={config.standardYears}>{config.standardYears} {it ? "anni – standard" : "years – standard"}</option>
        <option value={config.extendedYears}>{config.extendedYears} {it ? `anni – +${formatPct(config.upliftPercent)}%` : `years – +${formatPct(config.upliftPercent)}%`}</option>
      </select>
    </label>
    <small>{it
      ? "La maggiorazione viene applicata automaticamente al prezzo standard degli apparecchi LED. Il valore selezionato viene salvato nel Business Case."
      : "The uplift is applied automatically to the standard LED luminaire price. The selected value is saved with the Business Case."}</small>
  </div>;
}
