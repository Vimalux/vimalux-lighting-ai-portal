const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), 'src', 'CatalogueExtended.jsx');
let source = fs.readFileSync(file, 'utf8');
const malformed = 'update(["catalogue", "smart", i, "costPrice", v)';
const corrected = 'update(["catalogue", "smart", i, "costPrice"], v)';
if (source.includes(malformed)) {
  source = source.replace(malformed, corrected);
  fs.writeFileSync(file, source);
}
if (!source.includes('CCT/CRI Code') || !source.includes('cctCriCode')) {
  throw new Error('CCT/CRI catalogue UI update is missing');
}
