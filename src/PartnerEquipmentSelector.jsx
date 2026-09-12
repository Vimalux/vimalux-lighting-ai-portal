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
  // CMS products are independent of Adaptive Dimming and are shown whenever CMS is enabled.
  if (adaptive && !p.solution?.powerAidEnabled) return null;
  if (!adaptive && (!p.solution?.smartEnabled || !p.solution?.cmsEnabled)) return null;

  const availableToAdd = products.some((item) => !allRows.some((row) => row.productId === item.id));

  return <div className="optional-equipment partner-equipment-selector">
    <h3>{adaptive ? "Adaptive Dimming" : "CMS / Lighting Control"}</h3>

    {adaptive && <label><span>{it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"}</span><select aria-label={it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"} value={selectedPartner || ""} onChange={(e) => update(["solution", "adaptiveDimmingPartner"], e.target.value)}>
      <option value="">{it ? "-- seleziona partner --" : "-- select partner --"}</option>
      {adaptiveDimmingPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>}

    <p className="hint">{adaptive
      ? (it ? "Selezionare il partner e i prodotti per il dimming adattivo. Le quantità entrano nel CAPEX, nella lista ordini del relativo fornitore e nel report partner." : "Select the adaptive-dimming partner and products. Quantities feed CAPEX, the relevant supplier order list and the partner report.")
      : (it ? `Prodotti CMS aggiuntivi del partner ${selectedPartner || "selezionato"}. La LCU resta gestita separatamente con quantità automatica per apparecchio online.` : `Additional CMS products from ${selectedPartner || "the selected partner"}. The LCU remains separate with automatic quantity per online luminaire.`)}</p>

    {!adaptive && !products.length && <p className="hint">{it
      ? `Nessun prodotto CMS aggiuntivo configurato per ${selectedPartner || "il partner selezionato"}. I prodotti possono essere aggiunti nel Catalogo Prodotti.`
      : `No additional CMS products are configured for ${selectedPartner || "the selected partner"}. Products can be added in Product Catalogue.`}</p>}

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
