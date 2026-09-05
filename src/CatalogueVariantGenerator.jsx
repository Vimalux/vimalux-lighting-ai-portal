import React, { useMemo, useState } from "react";
import { generateCatalogueVariants } from "./catalogueVariants.js";

export default function CatalogueVariantGenerator({ product, existingProducts, onApply, makeId, it = false }) {
  const stored = product?.variantConfig || {};
  const [baseCode, setBaseCode] = useState(stored.baseCode || product?.variantBaseCode || product?.model || product?.name || "");
  const [wattages, setWattages] = useState(stored.wattages || (product?.wattage ? String(product.wattage) : ""));
  const [cctEfficiencies, setCctEfficiencies] = useState(stored.cctEfficiencies || "3000:155, 4000:165");
  const [optics, setOptics] = useState(stored.optics || "");
  const [controllers, setControllers] = useState(stored.controllers || (product?.zhaga ? "ZD" : ""));
  const [cri, setCri] = useState(stored.cri || 70);
  const [error, setError] = useState("");

  const preview = useMemo(() => {
    try {
      return generateCatalogueVariants(product, { baseCode, wattages, cctEfficiencies, optics, controllers, cri }, existingProducts, () => "preview");
    } catch {
      return [];
    }
  }, [product, existingProducts, baseCode, wattages, cctEfficiencies, optics, controllers, cri]);

  const apply = () => {
    try {
      const config = { baseCode, wattages, cctEfficiencies, optics, controllers, cri: Number(cri) || 70 };
      const variants = generateCatalogueVariants(product, config, existingProducts, makeId);
      onApply(config, variants);
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #dbe4ee", marginTop: 10, paddingTop: 14 }}>
    <strong>{it ? "Generatore varianti LED" : "LED variant generator"}</strong>
    <p className="hint">{it
      ? "Crea/aggiorna varianti da un unico prodotto master. I dati tecnici comuni vengono ereditati; per gli ibridi anche PV, batteria, peso e MPPT. Prezzi già modificati sulle varianti esistenti vengono mantenuti."
      : "Create/update variants from one master product. Common technical data is inherited; hybrid variants also inherit PV, battery, weight and MPPT. Existing variant prices are preserved."}</p>
    <div className="form-grid">
      <label><span>{it ? "Codice base" : "Base code"}</span><input value={baseCode} onChange={(e) => setBaseCode(e.target.value)} placeholder="ENBY-S / MANTA-STC3" /></label>
      <label><span>{it ? "Potenze (W)" : "Wattages (W)"}</span><input value={wattages} onChange={(e) => setWattages(e.target.value)} placeholder="20, 30, 40, 50, 60" /></label>
      <label><span>CCT : lm/W</span><input value={cctEfficiencies} onChange={(e) => setCctEfficiencies(e.target.value)} placeholder="3000:155, 4000:165" /></label>
      <label><span>{it ? "Ottiche" : "Optics"}</span><input value={optics} onChange={(e) => setOptics(e.target.value)} placeholder="L1, L2" /></label>
      <label><span>{it ? "Controller / interfaccia" : "Controller / interface"}</span><input value={controllers} onChange={(e) => setControllers(e.target.value)} placeholder="ZD, ZU" /></label>
      <label><span>CRI</span><input inputMode="numeric" value={cri} onChange={(e) => setCri(e.target.value)} placeholder="70" /></label>
    </div>
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
      <button type="button" className="primary" onClick={apply}>{it ? "Genera / aggiorna varianti" : "Generate / update variants"}</button>
      <span className="hint">{preview.length ? `${preview.length} ${it ? "varianti" : "variants"}` : "—"}</span>
    </div>
    {preview.length > 0 && <div className="hint" style={{ marginTop: 8 }}>{preview.slice(0, 6).map((item) => item.model).join(" · ")}{preview.length > 6 ? " …" : ""}</div>}
    {error && <div className="hint" style={{ color: "#b42318", marginTop: 8 }}>{error}</div>}
  </div>;
}
