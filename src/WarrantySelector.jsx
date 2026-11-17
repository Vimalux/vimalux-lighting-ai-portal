import React from "react";
import { catalogueWarranty, projectWarranty } from "./warranty.js";
import { solutionT } from "./solutionCopy.js";

export default function WarrantySelector({ p, update }) {
  const config = catalogueWarranty(p.catalogue);
  const warranty = projectWarranty(p);
  const locale = { it: "it-IT", en: "en-GB", da: "da-DK", es: "es-ES" }[p.language] || "en-GB";
  const formatPct = (value) => Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = (value) => {
    const years = Math.max(1, Math.min(30, Math.round(Number(value) || config.standardYears)));
    update(["solution", "warrantyYears"], years);
    if (years > config.standardYears) update(["solution", "warrantyUpliftPercentSnapshot"], config.upliftPercent);
  };
  return <div className="warranty-selector">
    <label>
      <span>{solutionT(p.language, "warranty")}</span>
      <input type="number" min="1" max="30" step="1" value={warranty.selectedYears} onChange={(event) => change(event.target.value)} />
    </label>
    <small>{solutionT(p.language, "warrantyHint", config.standardYears, formatPct(config.upliftPercent))}</small>
  </div>;
}
