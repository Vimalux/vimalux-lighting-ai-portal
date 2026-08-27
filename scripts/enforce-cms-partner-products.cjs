const fs = require('fs');

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`CMS product validation patch target not found (${label})`);
  return source.replace(before, after);
}

{
  const path = 'src/calculations.js';
  let source = fs.readFileSync(path, 'utf8');
  const original = '  const getSmart = (id) => smartById[id] || {};\n  const price = (product, key = "salesPrice") => project.pricing.overrides[product.id]?.[key] ?? positive(product[key]);\n  const lcu = getSmart(project.solution.lcuProductId), gateway = getSmart(project.solution.gatewayProductId);\n  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);';
  const previous = `  const getSmart = (id) => smartById[id] || {};
  const cmsPartner = String(project.solution?.cmsPartner || "DATEK").trim().toUpperCase();
  const productPartner = (product = {}) => {
    const values = [product.cmsPartner, product.vendor, product.supplier, product.manufacturer, product.brand, product.name]
      .map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);
    for (const known of ["DATEK", "ITRON", "TVILIGHT"]) if (values.some((value) => value.includes(known))) return known;
    if (values.some((value) => value === "VIMALUX")) return "DATEK";
    return "";
  };
  const rawLcu = getSmart(project.solution.lcuProductId);
  const lcuPricingValid = !cmsEnabled || (!cmsPartner ? Boolean(rawLcu.id) : productPartner(rawLcu) === cmsPartner);
  const lcu = lcuPricingValid ? rawLcu : {};
  const price = (product, key = "salesPrice") => product?.id ? (project.pricing.overrides[product.id]?.[key] ?? positive(product[key])) : 0;
  const gateway = getSmart(project.solution.gatewayProductId);
  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);`;
  const dynamic = `  const getSmart = (id) => smartById[id] || {};
  const productPartner = (product = {}) => {
    const direct = [product.cmsPartner, product.vendor, product.supplier]
      .map((value) => String(value || "").trim().toUpperCase()).find(Boolean);
    if (direct) return direct;
    return "";
  };
  const rawLcu = getSmart(project.solution.lcuProductId);
  const rawLcuPartner = productPartner(rawLcu);
  const cmsPartner = rawLcuPartner || String(project.solution?.cmsPartner || "").trim().toUpperCase();
  const lcuPricingValid = !cmsEnabled || (Boolean(rawLcu.id) && (!cmsPartner || !rawLcuPartner || rawLcuPartner === cmsPartner));
  const lcu = lcuPricingValid ? rawLcu : {};
  const price = (product, key = "salesPrice") => product?.id ? (project.pricing.overrides[product.id]?.[key] ?? positive(product[key])) : 0;
  const gateway = getSmart(project.solution.gatewayProductId);
  const antenna = getSmart(project.solution.antennaProductId), meter = getSmart(project.solution.meterProductId);`;
  if (source.includes(original)) source = source.replace(original, dynamic);
  else if (source.includes(previous)) source = source.replace(previous, dynamic);
  else if (!source.includes(dynamic)) throw new Error('CMS calculation partner guard target not found');
  source = replaceOnce(source,
    '  const cmsRevenue = cmsEnabled ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;',
    '  const cmsRevenue = cmsEnabled && lcuPricingValid ? lcuQuantity * price(lcu, "annualSalesPrice") : 0;',
    'CMS revenue guard');
  fs.writeFileSync(path, source);
}

{
  const path = 'src/App.jsx';
  let source = fs.readFileSync(path, 'utf8');
  const baseSelect = 'function ProductSelect({ label, type, p, value, onChange }) { return <Field label={label} value={value} onChange={onChange}>{p.catalogue.smart.filter((x) => x.type === type && x.active).map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }';
  const oldFilteredSelect = `function cmsProductPartner(product = {}) { const values = [product.cmsPartner,product.vendor,product.supplier,product.manufacturer,product.brand,product.name].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean); for (const known of CMS_PARTNERS) if (values.some((value) => value.includes(known))) return known; if (values.some((value) => value === "VIMALUX")) return "DATEK"; return ""; }
function ProductSelect({ label, type, p, value, onChange, cmsPartner }) { const partner = String(cmsPartner || "").trim().toUpperCase(); const products = p.catalogue.smart.filter((x) => x.type === type && x.active && (!partner || cmsProductPartner(x) === partner)); return <Field label={label} value={products.some((x) => x.id === value) ? value : ""} onChange={onChange}><option value="">{partner ? "-- " + partner + ": select product --" : "-- select product --"}</option>{products.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }`;
  const dynamicSelect = `function cmsProductPartner(product = {}) { return [product.cmsPartner,product.vendor,product.supplier].map((value) => String(value || "").trim().toUpperCase()).find(Boolean) || ""; }
function ProductSelect({ label, type, p, value, onChange, cmsPartner }) { const partner = String(cmsPartner || "").trim().toUpperCase(); const products = p.catalogue.smart.filter((x) => x.type === type && x.active && (!partner || cmsProductPartner(x) === partner)); return <Field label={label} value={products.some((x) => x.id === value) ? value : ""} onChange={onChange}><option value="">{partner ? "-- " + partner + ": select product --" : "-- select product --"}</option>{products.map((x) => <option key={x.id} value={x.id}>{x.brand} {x.name}</option>)}</Field>; }`;
  if (source.includes(baseSelect)) source = source.replace(baseSelect, dynamicSelect);
  else if (source.includes(oldFilteredSelect)) source = source.replace(oldFilteredSelect, dynamicSelect);
  else if (!source.includes(dynamicSelect)) throw new Error('partner-filtered ProductSelect target not found');

  const dynamicPartnerField = '<Field label="CMS Partner" value={resolveCmsPartner(p)} onChange={(v) => update(["solution","cmsPartner"],v)}>{cmsPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}</Field><ProductSelect label="LCU" type="LCU" p={p} value={p.solution.lcuProductId} onChange={(v) => update(["solution","lcuProductId"],v)} />';
  const dynamicPartnerFieldFiltered = '<Field label="CMS Partner" value={resolveCmsPartner(p)} onChange={(v) => update(["solution","cmsPartner"],v)}>{cmsPartnerOptions(p).map((name) => <option key={name} value={name}>{name}</option>)}</Field><ProductSelect label="LCU" type="LCU" p={p} value={p.solution.lcuProductId} onChange={(v) => update(["solution","lcuProductId"],v)} cmsPartner={resolveCmsPartner(p)} />';
  if (source.includes(dynamicPartnerField)) source = source.replace(dynamicPartnerField, dynamicPartnerFieldFiltered);
  else if (!source.includes(dynamicPartnerFieldFiltered)) throw new Error('LCU partner filter target not found');

  const originalSmart = '  const setSmartEnabled = (enabled) => { update(["solution","smartEnabled"],enabled); if (!enabled) { update(["solution","cmsEnabled"],false); update(["solution","powerAidEnabled"],false); } };';
  const oldSmart = `  const selectedCmsPartner = String(p.solution.cmsPartner || resolveCmsPartner(p) || "DATEK").toUpperCase();
  const selectedLcuProduct = (p.catalogue.smart || []).find((item) => item.id === p.solution.lcuProductId);
  const cmsPricingReady = !p.solution.cmsEnabled || (selectedLcuProduct && cmsProductPartner(selectedLcuProduct) === selectedCmsPartner);
  const setSmartEnabled = (enabled) => { update(["solution","smartEnabled"],enabled); if (!enabled) { update(["solution","cmsEnabled"],false); update(["solution","powerAidEnabled"],false); } };`;
  const newSmart = `  const selectedCmsPartner = String(resolveCmsPartner(p) || "").toUpperCase();
  const selectedLcuProduct = (p.catalogue.smart || []).find((item) => item.id === p.solution.lcuProductId);
  const cmsPricingReady = !p.solution.cmsEnabled || (selectedLcuProduct && (!selectedCmsPartner || cmsProductPartner(selectedLcuProduct) === selectedCmsPartner));
  const setSmartEnabled = (enabled) => { update(["solution","smartEnabled"],enabled); if (!enabled) { update(["solution","cmsEnabled"],false); update(["solution","powerAidEnabled"],false); } };`;
  if (source.includes(originalSmart)) source = source.replace(originalSmart, newSmart);
  else if (source.includes(oldSmart)) source = source.replace(oldSmart, newSmart);
  else if (!source.includes(newSmart)) throw new Error('CMS pricing state target not found');

  const warningNeedle = '  return <><Card title={t("solution")}>';
  if (source.includes(warningNeedle)) source = source.replace(warningNeedle,
    '  return <>{p.solution.cmsEnabled && !cmsPricingReady && <div className="status error" style={{marginBottom:12}}>CMS Partner {selectedCmsPartner} selected – no matching LCU/CMS product is configured. CMS hardware and recurring revenue are excluded until a matching product is selected or created in Catalogo Prodotti.</div>}<Card title={t("solution")}>');

  source = replaceOnce(source,
    '        let next = setPath({ ...p, updatedAt: changedAt }, path, normalized);',
    '        let next = setPath({ ...p, updatedAt: changedAt }, path, normalized);\n        if (path[0] === "solution" && path[1] === "cmsPartner") next = setPath(next, ["solution", "lcuProductId"], "");',
    'clear LCU on partner change');
  fs.writeFileSync(path, source);
}

console.log('CMS partner product/pricing validation follows Smart/CMS catalogue master data');
