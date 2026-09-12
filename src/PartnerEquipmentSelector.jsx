import React from "react";
import { adaptiveDimmingPartnerOptions, resolveAdaptiveDimmingPartner } from "./partners.js";
import { PARTNER_ROLES, partnerDisplayText, productRoles, productSupportsPartner } from "./partnerRoles.js";
import { uid } from "./model.js";

export default function PartnerEquipmentSelector({ p, update, adaptive = true }) {
  const it = p.language === "it";
  const smart = p.catalogue?.smart || [];
  const allRows = p.solution?.partnerEquipment || [];
  const belongs = (product) => product && (adaptive ? productRoles(product).includes("ADAPTIVE_DIMMING") : productRoles(product).some((role) => role === "GENERAL" || role === "HYBRID_LIGHTING"));
  const selectedPartner = p.solution?.adaptiveDimmingPartner ?? resolveAdaptiveDimmingPartner(p);
  const products = smart.filter((item) => item.active !== false && belongs(item) && (!adaptive || productSupportsPartner(item, selectedPartner, "ADAPTIVE_DIMMING")));
  const rows = allRows.map((row, index) => ({ row, index })).filter(({ row }) => row.partnerRole ? (adaptive ? row.partnerRole === "ADAPTIVE_DIMMING" : row.partnerRole !== "ADAPTIVE_DIMMING") : belongs(smart.find((item) => item.id === row.productId)));
  const replaceRows = (next) => update(["solution", "partnerEquipment"], next);
  const change = (index, field, value) => replaceRows(allRows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  if (!adaptive && !smart.some(belongs) && !rows.length) return null;
  return <div className="optional-equipment partner-equipment-selector">
    <h3>{adaptive ? "Adaptive Dimming" : it ? "Altre apparecchiature partner" : "Other partner equipment"}</h3>
    {adaptive && <label><span>{it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"}</span><select aria-label={it ? "Partner Adaptive Dimming" : "Adaptive Dimming Partner"} value={selectedPartner || ""} onChange={(e) => update(["solution", "adaptiveDimmingPartner"], e.target.value)}>
      <option value="">{it ? "-- seleziona partner --" : "-- select partner --"}</option>
      {adaptiveDimmingPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>}
    <p className="hint">{it ? "Prodotti del partner selezionato. Le quantità entrano nel CAPEX e nelle liste dei rispettivi fornitori." : "Selected partner products. Quantities feed CAPEX and each supplier's order list."}</p>
    <button type="button" className="secondary" disabled={!products.some((item) => !allRows.some((row) => row.productId === item.id))} onClick={() => replaceRows([...allRows, { id: uid(), partnerRole: adaptive ? "ADAPTIVE_DIMMING" : "GENERAL", productId: "", quantity: 1 }])}>+ {it ? "Aggiungi prodotto" : "Add product"}</button>
    {rows.map(({ row, index }) => <div className="form-grid" key={row.id || index}>
      <label><span>{adaptive ? "Adaptive Dimming product" : it ? "Prodotto partner" : "Partner product"}</span><select aria-label={adaptive ? "Adaptive Dimming product" : it ? "Prodotto partner" : "Partner product"} value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}>
        <option value="">{it ? "-- seleziona prodotto --" : "-- select product --"}</option>
        {products.filter((item) => item.id === row.productId || !allRows.some((other) => other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{partnerDisplayText(item.name)} · {item.supplier || ""} {item.supplierSku || ""}{adaptive ? "" : ` · ${productRoles(item).map((role) => PARTNER_ROLES[role]).join(", ")}`}</option>)}
        {row.productId && !products.some((item) => item.id === row.productId) && <option value={row.productId}>{partnerDisplayText(smart.find((item) => item.id === row.productId)?.name || row.productId)} · {it ? "non compatibile / non disponibile" : "incompatible / unavailable"}</option>}
      </select></label>
      <label><span>{it ? "Quantità" : "Quantity"}</span><input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(e) => change(index, "quantity", Math.max(0, Number(e.target.value) || 0))} /></label>
      <button type="button" className="danger secondary" onClick={() => replaceRows(allRows.filter((_, i) => i !== index))}>{it ? "Rimuovi" : "Remove"}</button>
    </div>)}
  </div>;
}
