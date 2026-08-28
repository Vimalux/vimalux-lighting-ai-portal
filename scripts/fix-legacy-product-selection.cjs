const fs = require('fs');
const path = 'src/App.jsx';
let s = fs.readFileSync(path, 'utf8');
const anchor = '  const setUpgradeForVisible = (upgradeSelected) => { if (!visibleGroups.length) return; update(["groups"], p.groups.map((group) => matchesFilter(group) ? { ...group, upgradeSelected } : group)); };\n';
const helper = anchor + '  const productsForGroup = (group) => { const active = p.catalogue.led.filter((product) => product.active); const current = p.catalogue.led.find((product) => product.id === group.proposedProductId); return current && !current.active ? [current, ...active] : active; };\n';
if (!s.includes('const productsForGroup = (group)')) {
  if (!s.includes(anchor)) throw new Error('Existing Lighting helper anchor not found');
  s = s.replace(anchor, helper);
}
const oldSelector = '>{p.catalogue.led.filter((x) => x.active).map((x) => <option value={x.id} key={x.id}>{x.brand} {x.name} · {x.wattage} W</option>)}</select></td><td><div className="wattage-input">';
const newSelector = '>{productsForGroup(g).map((x) => <option value={x.id} key={x.id}>{x.brand} {x.name} · {x.wattage} W{x.active ? "" : (p.language === "it" ? " · Legacy / inattivo" : " · Legacy / inactive")}</option>)}</select></td><td><div className="wattage-input">';
if (!s.includes(newSelector)) {
  if (!s.includes(oldSelector)) throw new Error('Existing Lighting product selector not found');
  s = s.replace(oldSelector, newSelector);
}
fs.writeFileSync(path, s);
console.log('Legacy project product selector patched');
