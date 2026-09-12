import React from "react";
import { adaptiveDimmingPartnerOptions, resolveAdaptiveDimmingPartner, resolveCmsPartner } from "./partners.js";
import { partnerDisplayText, productRoles, productSupportsPartner } from "./partnerRoles.js";
import { uid } from "./model.js";

export default function PartnerEquipmentSelector({ p, update, adaptive = true }) {
  const it = p.language === "it";
  const smart = p.catalogue?.smart || [];
  const allRows = p.solution?.partnerEquipment || [];
  const role = adaptive ? "ADAPTIVE_DIMMING" : "CMS";
  const selectedPartner = adaptive
    ? (p.solution?.adaptiveDimmingPartner ?? resolveAdaptiveDimmingPartner(p))
    : resolveCmsPartner(p);

  const belongs = (product) => product && productRoles(product).includes(role);
  const isLcuProduct = (product) => ["LCU", "ZHAGA"].includes(String(product?.type || "").trim().toUpperCase());
  const products = smart.filter((item) =>
    item.active !== false
    && belongs(item)
    && productSupportsPartner(item, selectedPartner, role)
    && (adaptive || !isLcuProduct(item))
  );

  const rows = allRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.partnerRole === role);

  const replaceRows = (next) => update(["solution", "partnerEquipment"], next);
  const change = (index, field, value) => replaceRows(allRows.map((row, i) => i === index ? { ...row, [field]: value } : row));

  // Adaptive Dimming products are only shown when Adaptive Dimming is enabled.
  // CMS products and LCU quantity are independent of Adaptive Dimming and are shown whenever CMS is enabled.
  if (adaptive && !p.solution?.powerAidEnabled) return null;
  if (!adaptive && (!p.solution?.smartEnabled || !p.solution?.cmsEnabled)) return null;

  const automaticLcuQuantity = (p.groups || []).reduce(
    (sum, group) => group?.upgradeSelected === false ? sum : sum + Math.max(0, Number(group?.quantity) || 0),
    0,
  );
  const hasLcuQuantityOverride = p.solution?.lcuQuantityOverride !== null
    && p.solution?.lcuQuantityOverride !== undefined
    && p.solution?.lcuQuantityOverride !== "";
  const lcuQuantity = hasLcuQuantityOverride
    ? Math.max(0, Number(p.solution.lcuQuantityOverride) || 0)
    : automaticLcuQuantity;
  const availableToAdd = products.some((item) => !allRows.some((row) => row.productId === item.id));

  return <div className="optional-equipment partner-equipment-selector">
    <h3>{adaptive ? "Adaptive Dimming" : "CMS / Lighting Control"}</h3>

    {adaptive && <label><span>{it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"}</span><select aria-label={it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"} value={selectedPartner || ""} onChange={(e) => update(["solution", "adaptiveDimmingPartner"], e.target.value)}>
      <option value="">{it ? "-- seleziona partner --" : "-- select partner --"}</option>
      {adaptiveDimmingPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>}

    {!adaptive && <div className="form-grid lcu-quantity-control">
      <label><span>{it ? "Quantità LCU" : "LCU quantity"}</span><input type="number" min="0" step="1" value={lcuQuantity} onChange={(e) => update(["solution", "lcuQuantityOverride"], e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))} /></label>
      <div className="lcu-quantity-auto">
        <span className="hint">{it ? `Automatico: ${automaticLcuQuantity} unità (uguale agli apparecchi selezionati per l'upgrade)` : `Automatic: ${automaticLcuQuantity} units (equal to luminaires selected for upgrade)`}</span>
        {hasLcuQuantityOverride && <button type="button" className="secondary partner-add-button" onClick={() => update(["solution", "lcuQuantityOverride"], null)}>{it ? "Ripristina automatico" : "Reset to automatic"}</button>}
      </div>
    </div>}

    <p className="hint">{adaptive
      ? (it ? "Selezionare il partner e i prodotti per il dimming adattivo. Le quantità entrano nel CAPEX, nella lista ordini del relativo fornitore e nel report partner." : "Select the adaptive-dimming partner and products. Quantities feed CAPEX, the relevant supplier order list and the partner report.")
      : (it ? `La quantità LCU parte automaticamente dal numero di apparecchi da aggiornare e può essere modificata per il progetto. Eventuali altri prodotti CMS del partner ${selectedPartner || "selezionato"} possono essere aggiunti qui sotto.` : `LCU quantity starts automatically from the number of luminaires to upgrade and can be changed for the project. Any additional CMS products from ${selectedPartner || "the selected partner"} can be added below.`)}</p>

    {!adaptive && !products.length && <p className="hint">{it
      ? `Nessun prodotto CMS aggiuntivo configurato per ${selectedPartner || "il partner selezionato"}. La LCU selezionata sopra resta comunque attiva.`
      : `No additional CMS products are configured for ${selectedPartner || "the selected partner"}. The LCU selected above remains active.`}</p>}

    {(adaptive || products.length > 0 || rows.length > 0) && <button type="button" className="secondary partner-add-button" disabled={!availableToAdd} onClick={() => replaceRows([...allRows, { id: uid(), partnerRole: role, productId: "", quantity: 1 }])}>+ {adaptive ? (it ? "Aggiungi prodotto" : "Add product") : (it ? "Aggiungi prodotto CMS" : "Add CMS product")}</button>}

    {rows.map(({ row, index }) => <div className="form-grid partner-equipment-row" key={row.id || index}>
      <label><span>{adaptive ? (it ? "Prodotto Adaptive Dimming" : "Adaptive Dimming product") : (it ? "Prodotto CMS" : "CMS product")}</span><select aria-label={adaptive ? (it ? "Prodotto Adaptive Dimming" : "Adaptive Dimming product") : (it ? "Prodotto CMS" : "CMS product")} value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}>
        <option value="">{it ? "-- seleziona prodotto --" : "-- select product --"}</option>
        {products.filter((item) => item.id === row.productId || !allRows.some((other) => other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{partnerDisplayText(item.name)} · {item.supplier || ""} {item.supplierSku || ""}</option>)}
        {row.productId && !products.some((item) => item.id === row.productId) && <option value={row.productId}>{partnerDisplayText(smart.find((item) => item.id === row.productId)?.name || row.productId)} · {it ? "non compatibile / non disponibile" : "incompatible / unavailable"}</option>}
      </select></label>
      <label><span>{it ? "Quantità" : "Quantity"}</span><input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(e) => change(index, "quantity", Math.max(0, Number(e.target.value) || 0))} /></label>
      <button type="button" className="danger secondary partner-remove-button" onClick={() => replaceRows(allRows.filter((_, i) => i !== index))}>{it ? "Rimuovi" : "Remove"}</button>
    </div>)}
  </div>;
}
