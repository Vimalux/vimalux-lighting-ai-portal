const fs = require('fs');

function patchFile(path, transforms) {
  let source = fs.readFileSync(path, 'utf8');
  for (const { before, after, label } of transforms) {
    if (source.includes(after)) continue;
    // Editable luminaire category now lives in canonical App.jsx.
    if (label === 'category-filter product choices' && source.includes('compatibleExistingCategories')) continue;
    if (label === 'existing luminaire type cell' && source.includes('luminaireCategory || g.existingCategory || "OTHER"} disabled={readOnly}')) continue;
    if (!source.includes(before)) throw new Error(`Patch target not found (${label}) in ${path}`);
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source);
}

patchFile('src/lightingImport.js', [
  {
    label: 'compatibility import',
    before: 'import { uid } from "./model.js";',
    after: 'import { uid } from "./model.js";\nimport { compatibleLedProducts } from "./productCatalogue.js";',
  },
  {
    label: 'recommend signature',
    before: 'export function recommendLedProduct(existingWattage, technology, ledProducts = []) {\n  const target = targetLedWattage(existingWattage, technology);\n  const active = ledProducts.filter(product => product.active !== false && numberValue(product.wattage) > 0);\n  const candidates = active.length ? active : ledProducts.filter(product => numberValue(product.wattage) > 0);',
    after: 'export function recommendLedProduct(existingWattage, technology, ledProducts = [], existingCategory = "OTHER", replacementRequirement = "UNKNOWN") {\n  const target = targetLedWattage(existingWattage, technology);\n  const compatible = compatibleLedProducts(ledProducts, existingCategory, replacementRequirement).filter(product => numberValue(product.wattage) > 0);\n  const active = ledProducts.filter(product => product.active !== false && numberValue(product.wattage) > 0);\n  const candidates = compatible.length ? compatible : (active.length ? active : ledProducts.filter(product => numberValue(product.wattage) > 0));',
  },
  {
    label: 'recommend category call',
    before: '  const recommendation = recommendLedProduct(wattage, technology, ledProducts);',
    after: '  const recommendation = recommendLedProduct(wattage, technology, ledProducts, category, replacementRequirement);',
  },
  {
    label: 'grouping keeps location',
    before: '    const key = `${category}|${replacementRequirement}|${technology}|${wattage}|${operatingHours}`;',
    after: '    const locationKey = clean(suppliedName);\n    const key = `${locationKey}|${category}|${replacementRequirement}|${technology}|${wattage}|${operatingHours}`;',
  },
]);

patchFile('src/agentProjectInputs.js', [
  {
    label: 'italian deal labels',
    before: '    hours: "Ore operative annue",\n    help:',
    after: '    hours: "Ore operative annue",\n    deal: "Soluzione commerciale",\n    cash: "Acquisto diretto",\n    finance: "Finanziamento ESCO",\n    noleggio: "Noleggio Operativo / LaaS",\n    help:',
  },
  {
    label: 'danish deal labels',
    before: '    hours: "Årlige brændetimer",\n    help:',
    after: '    hours: "Årlige brændetimer",\n    deal: "Kommerciel løsning",\n    cash: "Direkte køb",\n    finance: "ESCO-finansiering",\n    noleggio: "Noleggio Operativo / LaaS",\n    help:',
  },
  {
    label: 'english deal labels',
    before: '    hours: "Annual operating hours",\n    help:',
    after: '    hours: "Annual operating hours",\n    deal: "Commercial solution",\n    cash: "Direct purchase",\n    finance: "ESCO financing",\n    noleggio: "Operating lease / LaaS",\n    help:',
  },
  {
    label: 'agent deal selector UI',
    before: '        <label><span>${text.hours}</span><input data-agent-hours inputmode="numeric" value="${Number(project.assumptions?.operatingHours ?? 0)}"></label>\n      </div>',
    after: '        <label><span>${text.hours}</span><input data-agent-hours inputmode="numeric" value="${Number(project.assumptions?.operatingHours ?? 0)}"></label>\n        <label><span>${text.deal}</span><select data-agent-deal><option value="cash" ${project.assumptions?.dealType === "cash" ? "selected" : ""}>${text.cash}</option><option value="finance" ${project.assumptions?.dealType === "finance" ? "selected" : ""}>${text.finance}</option><option value="noleggio_operativo" ${project.assumptions?.dealType === "noleggio_operativo" ? "selected" : ""}>${text.noleggio}</option></select></label>\n      </div>',
  },
  {
    label: 'read agent deal',
    before: '      const operatingHours = Math.max(0, Math.round(numberValue(card.querySelector("[data-agent-hours]")?.value)));',
    after: '      const operatingHours = Math.max(0, Math.round(numberValue(card.querySelector("[data-agent-hours]")?.value)));\n      const dealType = String(card.querySelector("[data-agent-deal]")?.value || "cash");',
  },
  {
    label: 'save agent deal',
    before: '              operatingHours,\n            },',
    after: '              operatingHours,\n              dealType,\n            },',
  },
]);

patchFile('src/App.jsx', [
  {
    label: 'catalogue compatibility import for existing lighting',
    before: 'import CatalogueExtended from "./CatalogueExtended.jsx";',
    after: 'import CatalogueExtended from "./CatalogueExtended.jsx";\nimport { compatibleLedProducts } from "./productCatalogue.js";',
  },
  {
    label: 'restore assumptions to agent workflow',
    before: 'const agentWorkflow = [\n  ...workflow.slice(0, 3),\n  ["additionalCosts", "additionalCosts"],\n  ...workflow.slice(5),\n];',
    after: 'const agentWorkflow = [\n  ...workflow.slice(0, 3),\n  ["additionalCosts", "additionalCosts"],\n  ["assumptions", "assumptions"],\n  ...workflow.slice(5),\n];',
  },
  {
    label: 'allow safe agent assumptions only',
    before: '      if (isAgent && ["pricing", "assumptions"].includes(path[0])) return all;',
    after: '      if (isAgent && path[0] === "pricing") return all;\n      if (isAgent && path[0] === "assumptions" && !["energyPrice", "operatingHours", "dealType"].includes(path[1])) return all;',
  },
  {
    label: 'render safe agent assumptions',
    before: '          {!isAgent && view === "assumptions" && <Assumptions p={project} r={result} update={update} />}',
    after: '          {view === "assumptions" && (isAgent ? <AgentAssumptions p={project} update={update} /> : <Assumptions p={project} r={result} update={update} />)}',
  },
  {
    label: 'agent assumptions component',
    before: 'const Card = ({ title, children, className = "" }) => <section className={`card ${className}`.trim()}><h2>{title}</h2>{children}</section>;\n\nfunction Customer({ p, update }) {',
    after: 'const Card = ({ title, children, className = "" }) => <section className={`card ${className}`.trim()}><h2>{title}</h2>{children}</section>;\n\nfunction AgentAssumptions({ p, update }) {\n  const it = p.language === "it";\n  return <Card title={it ? "Assunzioni progetto" : "Project assumptions"}><div className="form-grid"><Field label={it ? "Prezzo energia (EUR/kWh)" : "Energy price (EUR/kWh)"} value={p.assumptions.energyPrice} onChange={(v) => update(["assumptions","energyPrice"],v)} /><Field label={it ? "Ore operative annue" : "Annual operating hours"} value={p.assumptions.operatingHours} onChange={(v) => update(["assumptions","operatingHours"],v)} /><Field label={it ? "Soluzione commerciale" : "Commercial solution"} value={p.assumptions.dealType || "cash"} onChange={(v) => update(["assumptions","dealType"],v)}><option value="cash">{it ? "Acquisto diretto" : "Direct purchase"}</option><option value="finance">{it ? "Finanziamento ESCO" : "ESCO financing"}</option><option value="noleggio_operativo">Noleggio Operativo / LaaS</option></Field></div><p className="muted">{it ? "L’agente può modificare solo i parametri specifici del progetto. Prezzi, margini, aliquote IVA e parametri finanziari interni restano gestiti da VIMALUX." : "The agent can only change project-specific inputs. Prices, margins, VAT rates and internal financing assumptions remain controlled by VIMALUX."}</p></Card>;\n}\n\nfunction Customer({ p, update }) {',
  },
  {
    label: 'existing category label helper',
    before: '  const [bulkProduct, setBulkProduct] = useState("");',
    after: '  const [bulkProduct, setBulkProduct] = useState("");\n  const categoryLabel = (value) => ({ STREET: p.language === "it" ? "Stradale" : "Street", URBAN: p.language === "it" ? "Urbano" : "Urban", GLOBO: "Globo", FLOODLIGHT: p.language === "it" ? "Proiettore" : "Floodlight", UPLIGHT: "Uplight", LANTERN: p.language === "it" ? "Lanterna" : "Lantern", RETROFIT_KIT: "Retrofit kit", OTHER: p.language === "it" ? "Altro" : "Other" }[String(value || "OTHER").toUpperCase()] || value || "—");',
  },
  {
    label: 'category-filter product choices',
    before: '  const productsForGroup = (group) => { const active = p.catalogue.led.filter((product) => product.active); const current = p.catalogue.led.find((product) => product.id === group.proposedProductId); return current && !current.active ? [current, ...active] : active; };',
    after: '  const productsForGroup = (group) => { const compatible = compatibleLedProducts(p.catalogue.led, group.existingCategory || group.luminaireCategory || "OTHER", group.replacementRequirement || "UNKNOWN"); const current = p.catalogue.led.find((product) => product.id === group.proposedProductId); return current && !compatible.some((product) => product.id === current.id) ? [current, ...compatible] : compatible; };',
  },
  {
    label: 'existing luminaire type header',
    before: 'p.language === "it" ? "Tecnologia" : "Technology",p.language === "it" ? "Potenza esistente" : "Existing wattage"',
    after: 'p.language === "it" ? "Tecnologia" : "Technology",p.language === "it" ? "Tipo apparecchio" : "Luminaire type",p.language === "it" ? "Potenza esistente" : "Existing wattage"',
  },
  {
    label: 'existing luminaire type cell',
    before: '</select></td><td><NumericInput value={g.existingWattage}',
    after: '</select></td><td>{categoryLabel(g.existingCategory || g.luminaireCategory)}</td><td><NumericInput value={g.existingWattage}',
  },
]);

patchFile('src/main.jsx', [
  {
    label: 'remove legacy agent parameter injection',
    before: 'import "./agentProjectInputs.js";\n',
    after: '',
  },
]);

console.log('Agent grouping, luminaire compatibility, type summary and safe assumptions patched');
