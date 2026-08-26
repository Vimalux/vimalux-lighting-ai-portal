const fs = require('fs');

function patchFile(path, transforms) {
  let source = fs.readFileSync(path, 'utf8');
  for (const { before, after, label } of transforms) {
    if (source.includes(after)) continue;
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

console.log('Agent input grouping, compatibility and finance selector patched');
