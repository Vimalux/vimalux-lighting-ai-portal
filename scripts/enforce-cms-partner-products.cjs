const fs = require('fs');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`CMS product validation patch target not found (${label})`);
  return source.replace(before, after);
}

// 1) Calculation engine: never reuse another CMS partner's product pricing.
{
  const path = 'src/calculations.js';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    '  const getSmart = (id) => smartById[id] || {};\n  const price = (product, key = "salesPrice") => project.pricing.overrides[product.id]?.[key] ?? positive(product[key]);\n  const lcu = getSmart(project.solution.lcuProductId), gateway = getSmart(project.solution.gatewayProductId);\n  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);',
    `  const getSmart = (id) => smartById[id] || {};
  const cmsPartner = String(project.solution?.cmsPartner || "DATEK").trim().toUpperCase();
  const productPartner = (product = {}) => {
    const values = [product.cmsPartner, product.vendor, product.supplier, product.manufacturer, product.brand, product.name]
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean);
    for (const known of ["DATEK", "ITRON", "TVILIGHT"]) if (values.some((value) => value.includes(known))) return known;
    // Legacy VIMALUX-branded LCU entries were DATEK commercial products.
    if (values.some((value) => value === "VIMALUX")) return "DATEK";
    return "";
  };
  const compatibleCmsProduct = (product) => !cmsEnabled || !cmsPartner || productPartner(product) === cmsPartner;
  const rawLcu = getSmart(project.solution.lcuProductId);
  const lcuPricingValid = compatibleCmsProduct(rawLcu) && Boolean(rawLcu.id);
  const lcu = lcuPricingValid ? rawLcu : {};
  const price = (product, key = "salesPrice") => product?.id ? (project.pricing.overrides[product.id]?.[key] ?? positive(product[key])) : 0;
  const gateway = getSmart(project.solution.gatewayProductId);
  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);`,
    'calculation partner guard'
  );
  source = replaceOnce(
    source,
    '  const cmsRevenue = cmsEnabled ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;',
    '  const cmsRevenue = cmsEnabled && lcuPricingValid ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;',
    'CMS revenue guard'
  );
  fs.writeFileSync(path, source);
}

// 2) UI: only show LCU products belonging to the chosen CMS partner and warn if pricing is incomplete.
{
  const path = 'src/App.jsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'function ProductSelect({ label, type, p, value, onChange }) { return <Field label={label} value={value} onChange={onChange}>{p.catalogue.smart.filter((x) => x.type === type && x.active).map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }',
    `function cmsProductPartner(product = {}) { const values = [product.cmsPartner,product.vendor,product.supplier,product.manufacturer,product.brand,product.name].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean); for (const known of CMS_PARTNERS) if (values.some((value) => value.includes(known))) return known; if (values.some((value) => value === "VIMALUX")) return "DATEK"; return ""; }
function ProductSelect({ label, type, p, value, onChange, cmsPartner }) { const partner = String(cmsPartner || "").trim().toUpperCase(); const products = p.catalogue.smart.filter((x) => x.type === type && x.active && (!partner || cmsProductPartner(x) === partner)); return <Field label={label} value={products.some((x) => x.id === value) ? value : ""} onChange={onChange}><option value="">{partner ? `-- ${partner}: select product --` : "-- select product --"}</option>{products.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }`,
    'partner-filtered ProductSelect'
  );
  source = replaceOnce(
    source,
    '<Field label="CMS Partner" value={p.solution.cmsPartner || resolveCmsPartner(p) || "DATEK"} onChange={(v) => update(["solution","cmsPartner"],v)}>{CMS_PARTNERS.map((name) => <option key={name} value={name}>{name}</option>)}</Field><ProductSelect label="LCU" type="LCU" p={p} value={p.solution.lcuProductId} onChange={(v) => update(["solution","lcuProductId"],v)} />',
    '<Field label="CMS Partner" value={p.solution.cmsPartner || resolveCmsPartner(p) || "DATEK"} onChange={(v) => update(["solution","cmsPartner"],v)}>{CMS_PARTNERS.map((name) => <option key={name} value={name}>{name}</option>)}</Field><ProductSelect label="LCU" type="LCU" p={p} value={p.solution.lcuProductId} onChange={(v) => update(["solution","lcuProductId"],v)} cmsPartner={p.solution.cmsPartner || resolveCmsPartner(p) || "DATEK"} />',
    'LCU partner filter'
  );
  source = replaceOnce(
    source,
    '  const setSmartEnabled = (enabled) => { update(["solution","smartEnabled"],enabled); if (!enabled) { update(["solution","cmsEnabled"],false); update(["solution","powerAidEnabled"],false); } };',
    `  const selectedCmsPartner = String(p.solution.cmsPartner || resolveCmsPartner(p) || "DATEK").toUpperCase();
  const selectedLcuProduct = (p.catalogue.smart || []).find((item) => item.id === p.solution.lcuProductId);
  const cmsPricingReady = !p.solution.cmsEnabled || (selectedLcuProduct && cmsProductPartner(selectedLcuProduct) === selectedCmsPartner);
  const setSmartEnabled = (enabled) => { update(["solution","smartEnabled"],enabled); if (!enabled) { update(["solution","cmsEnabled"],false); update(["solution","powerAidEnabled"],false); } };`,
    'CMS pricing state'
  );
  // Insert visible warning at beginning of Solution return content, using an existing stable marker.
  source = replaceOnce(
    source,
    '  return <><Card title={t("solution")}>',
    '  return <>{p.solution.cmsEnabled && !cmsPricingReady && <div className="status error" style={{marginBottom:12}}>CMS Partner {selectedCmsPartner} selected – no matching LCU/CMS product is configured. CMS hardware and recurring revenue are excluded until a {selectedCmsPartner} product is selected or created in Catalogo Prodotti.</div>}<Card title={t("solution")}>',
    'CMS pricing warning'
  );
  // Clear the selected LCU when CMS partner changes, so an old vendor product can never remain silently selected.
  source = replaceOnce(
    source,
    '        let next = setPath({ ...p, updatedAt: changedAt }, path, normalized);',
    '        let next = setPath({ ...p, updatedAt: changedAt }, path, normalized);\n        if (path[0] === "solution" && path[1] === "cmsPartner") next = setPath(next, ["solution", "lcuProductId"], "");',
    'clear LCU on partner change'
  );
  fs.writeFileSync(path, source);
}

console.log('CMS partner product/pricing validation enforced');
