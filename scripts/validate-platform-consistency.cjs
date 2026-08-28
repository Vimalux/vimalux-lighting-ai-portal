const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('src/App.jsx');
const main = read('src/main.jsx');
const catalogue = read('src/productCatalogue.js');
const warranty = read('src/warranty.js');
const report = read('src/report.js');
const preliminaryProposal = read('src/preliminaryProposal.js');

const checks = [
  {
    name: 'Agent workflow includes Assunzioni after Additional Costs',
    ok: /\["additionalCosts", "additionalCosts"\],\r?\n\s*\["assumptions", "assumptions"\]/.test(app),
  },
  {
    name: 'Agent Assunzioni component is rendered',
    ok: app.includes('function AgentAssumptions') && app.includes('Assunzioni progetto'),
  },
  {
    name: 'Existing lighting has persisted editable luminaire type',
    ok: app.includes('Tipo apparecchio')
      && app.includes('luminaireCategory: category, existingCategory: category')
      && app.includes('disabled={readOnly}'),
  },
  {
    name: 'Replacement choices use catalogue compatibility logic',
    ok: app.includes('compatibleLedProducts') && catalogue.includes('compatibleLedProducts'),
  },
  {
    name: 'Legacy agent parameter injection is disabled',
    ok: !main.includes('import "./agentProjectInputs.js"'),
  },
  {
    name: 'Agent pricing remains protected',
    ok: app.includes('if (isAgent && path[0] === "pricing") return all;'),
  },
  {
    name: 'Shared agent projects are read only',
    ok: app.includes('if (isReadOnlyAgentProject) return all;')
      && app.includes('agentAccessMode'),
  },
  {
    name: 'Official input sheet applies groups and project identity atomically',
    ok: app.includes('if (path[0] === "importSheet")')
      && app.includes('source: "official_input_sheet"')
      && app.includes('customerName: sheet.customerName')
      && app.includes('projectName: sheet.projectName')
      && app.includes('sheetName: sheet.name'),
  },
  {
    name: 'Official identity import is restricted to official VIMALUX sheet names',
    ok: app.includes('/^ProjectInputSheet(?:_ITA)?$/i.test'),
  },
  {
    name: 'Agent import uses the same atomic official identity path',
    ok: app.includes('update(["importSheet"], { groups, mode')
      && !app.includes('update(["groups"], mode === "append" ? [...p.groups, ...groups] : groups); setImporter(null);'),
  },
  {
    name: 'Customer-facing warranty label contains term only',
    ok: warranty.includes('`${warranty.selectedYears} anni`')
      && warranty.includes('`${warranty.selectedYears} years`')
      && !warranty.includes('return warranty.isExtended ? `${warranty.selectedYears} anni · +')
      && !warranty.includes('`${warranty.selectedYears} anni · standard`'),
  },
  {
    name: 'All customer PDFs use the shared warranty label',
    ok: report.includes('[it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)]')
      && preliminaryProposal.includes('[it ? "Garanzia apparecchi" : "Luminaire warranty", warrantyLabel(project, lang)]'),
  },
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}: ${check.name}`);
}

if (failed.length) {
  console.error(`\nPlatform consistency check failed: ${failed.length} invariant(s) missing.`);
  console.error('A newer patch may have overwritten an approved platform change. Review patch order and dependent UI/report/access logic before deployment.');
  process.exit(1);
}

console.log('\nPlatform consistency check passed.');
