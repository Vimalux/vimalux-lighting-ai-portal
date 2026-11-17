import React, { useEffect } from "react";
import { adaptiveDimmingPartnerOptions, resolveAdaptiveDimmingPartner, resolveCmsPartner } from "./partners.js";
import { partnerDisplayText, productRoles, productSupportsPartner } from "./partnerRoles.js";
import { uid } from "./model.js";
import { solutionT } from "./solutionCopy.js";

export default function PartnerEquipmentSelector({ p, update, adaptive = true }) {
  const s = (key, ...args) => solutionT(p.language, key, ...args);
  const smart = p.catalogue?.smart || [];
  const allRows = p.solution?.partnerEquipment || [];
  const role = adaptive ? "ADAPTIVE_DIMMING" : "CMS";
  const selectedPartner = adaptive
    ? (p.solution?.adaptiveDimmingPartner ?? resolveAdaptiveDimmingPartner(p))
    : resolveCmsPartner(p);

  const belongs = (product) => product && productRoles(product).includes(role);
  const isLcuProduct = (product) => ["LCU", "ZHAGA"].includes(String(product?.type || "").trim().toUpperCase());
  const compatibleCmsProducts = smart.filter((item) =>
    item.active !== false
    && belongs(item)
    && productSupportsPartner(item, selectedPartner, role)
  );
  const lcuProducts = adaptive ? [] : compatibleCmsProducts.filter(isLcuProduct);
  const products = compatibleCmsProducts.filter((item) => adaptive || !isLcuProduct(item));

  const rows = allRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.partnerRole === role);

  const replaceRows = (next) => update(["solution", "partnerEquipment"], next);
  const change = (index, field, value) => replaceRows(allRows.map((row, i) => i === index ? { ...row, [field]: value } : row));

  // During staging the old top-level LCU selector is still present in App.jsx.
  // Hide that duplicate control once the consolidated CMS block is mounted.
  useEffect(() => {
    if (adaptive) return undefined;
    const select = document.querySelector('select[aria-label="LCU"]');
    const label = select?.closest("label");
    if (!label) return undefined;
    const previousDisplay = label.style.display;
    label.style.display = "none";
    return () => { label.style.display = previousDisplay; };
  }, [adaptive]);

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
    <h3>{adaptive ? "Adaptive Dimming" : s("cmsControl")}</h3>

    {adaptive && <label><span>{s("adaptivePartner")}</span><select aria-label={s("adaptivePartner")} value={selectedPartner || ""} onChange={(e) => update(["solution", "adaptiveDimmingPartner"], e.target.value)}>
      <option value="">{s("selectPartner")}</option>
      {adaptiveDimmingPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}
    </select></label>}

    {!adaptive && <>
      <div className="form-grid">
        <label><span>{s("lcuProduct")}</span><select aria-label={s("lcuProduct")} value={lcuProducts.some((item) => item.id === p.solution?.lcuProductId) ? p.solution.lcuProductId : ""} onChange={(e) => update(["solution", "lcuProductId"], e.target.value)}>
          <option value="">{s("selectLcu")}</option>
          {lcuProducts.map((item) => <option key={item.id} value={item.id}>{partnerDisplayText(item.name)} · {item.supplier || ""} {item.supplierSku || ""}</option>)}
        </select></label>
        <label><span>{s("lcuQuantity")}</span><input type="number" min="0" step="1" value={lcuQuantity} onChange={(e) => update(["solution", "lcuQuantityOverride"], e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))} /></label>
      </div>
      <div className="lcu-quantity-auto">
        <span className="hint">{s("automaticQuantity", automaticLcuQuantity)}</span>
        {hasLcuQuantityOverride && <button type="button" className="secondary partner-add-button" onClick={() => update(["solution", "lcuQuantityOverride"], null)}>{s("resetAutomatic")}</button>}
      </div>
    </>}

    <p className="hint">{adaptive ? s("adaptiveProductsHint") : s("cmsProductsHint", selectedPartner)}</p>

    {!adaptive && !lcuProducts.length && <p className="hint">{s("noLcu", selectedPartner)}</p>}

    {!adaptive && !products.length && <p className="hint">{s("noCmsProducts", selectedPartner)}</p>}

    {(adaptive || products.length > 0 || rows.length > 0) && <button type="button" className="secondary partner-add-button" disabled={!availableToAdd} onClick={() => replaceRows([...allRows, { id: uid(), partnerRole: role, productId: "", quantity: 1 }])}>+ {adaptive ? s("addProduct") : s("addCmsProduct")}</button>}

    {rows.map(({ row, index }) => <div className="form-grid partner-equipment-row" key={row.id || index}>
      <label><span>{adaptive ? s("adaptiveProduct") : s("cmsProduct")}</span><select aria-label={adaptive ? s("adaptiveProduct") : s("cmsProduct")} value={row.productId || ""} onChange={(e) => change(index, "productId", e.target.value)}>
        <option value="">{s("selectProduct")}</option>
        {products.filter((item) => item.id === row.productId || !allRows.some((other) => other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{partnerDisplayText(item.name)} · {item.supplier || ""} {item.supplierSku || ""}</option>)}
        {row.productId && !products.some((item) => item.id === row.productId) && <option value={row.productId}>{partnerDisplayText(smart.find((item) => item.id === row.productId)?.name || row.productId)} · {s("incompatible")}</option>}
      </select></label>
      <label><span>{s("quantity")}</span><input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(e) => change(index, "quantity", Math.max(0, Number(e.target.value) || 0))} /></label>
      <button type="button" className="danger secondary partner-remove-button" onClick={() => replaceRows(allRows.filter((_, i) => i !== index))}>{s("remove")}</button>
    </div>)}
  </div>;
}
