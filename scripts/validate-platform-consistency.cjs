const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('src/App.jsx');
const main = read('src/main.jsx');
const catalogue = read('src/productCatalogue.js');

const checks = [
  {
    name: 'Agent workflow includes Assunzioni after Additional Costs',
    ok: app.includes('["additionalCosts", "additionalCosts"],\n  ["assumptions", "assumptions"]'),
  },
  {
    name: 'Agent Assunzioni component is rendered',
    ok: app.includes('function AgentAssumptions') && app.includes('Assunzioni progetto'),
  },
  {
    name: 'Existing lighting shows luminaire type',
    ok: app.includes('Tipo apparecchio') && app.includes('categoryLabel(g.existingCategory || g.luminaireCategory)'),
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
