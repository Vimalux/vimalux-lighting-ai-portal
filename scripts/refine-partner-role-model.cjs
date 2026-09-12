const fs = require('fs');
const path = 'src/App.jsx';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  'import { cmsPartnerOptions, growthForecast, partnerTotals, resolveCmsPartner } from "./partners.js";',
  'import { adaptiveDimmingPartnerOptions, cmsPartnerOptions, partnerTotals, resolveAdaptiveDimmingPartner, resolveCmsPartner, technologyPartnerOptions } from "./partners.js";',
);

const selectorStart = s.indexOf('function PartnerEquipmentSelector(');
const solutionStart = s.indexOf('\nfunction Solution(', selectorStart);
if (selectorStart < 0 || solutionStart < 0) throw new Error('PartnerEquipmentSelector block not found');
const selector = `function PartnerEquipmentSelector({ p, update }) {
  const allSmart = p.catalogue?.smart || [];
  const adaptiveProducts = allSmart.filter((item) => item.active !== false && (String(item.type || '').toUpperCase() === 'OTHER' || String(item.partnerRole || '').toUpperCase() === 'ADAPTIVE_DIMMING'));
  const partnerOptions = adaptiveDimmingPartnerOptions(p);
  const selectedPartner = String(resolveAdaptiveDimmingPartner(p) || p.solution?.adaptiveDimmingPartner || '').toUpperCase();
  const products = selectedPartner
    ? adaptiveProducts.filter((item) => String(item.supplier || item.vendor || '').toUpperCase() === selectedPartner)
    : [];
  const rows = Array.isArray(p.solution?.partnerEquipment) ? p.solution.partnerEquipment : [];
  if (!adaptiveProducts.length && !rows.length) return null;
  const setPartner = (value) => update(['solution'], { ...p.solution, adaptiveDimmingPartner: value, partnerEquipment: [] });
  const replaceRows = (next) => update(['solution','partnerEquipment'], next);
  const add = () => replaceRows([...rows, { id: uid(), productId: '', quantity: 1 }]);
  const change = (index, field, value) => replaceRows(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const remove = (index) => replaceRows(rows.filter((_, i) => i !== index));
  return <div className="optional-equipment partner-equipment-selector">
    <div className="card-title-row" style={{ marginTop: 14 }}><div><strong>Adaptive Dimming</strong><p className="hint">{p.language === 'it' ? 'Selezionare il partner e i prodotti per il dimming adattivo. Il partner selezionato viene utilizzato anche per lista ordini e report partner.' : 'Select the adaptive-dimming partner and products. The selected partner is also used for supplier orders and partner reports.'}</p></div></div>
    <div className="form-grid"><label><span>{p.language === 'it' ? 'Partner Adaptive Dimming' : 'Adaptive Dimming Partner'}</span><select value={selectedPartner} onChange={(e) => setPartner(e.target.value)}><option value="">{p.language === 'it' ? '-- seleziona partner --' : '-- select partner --'}</option>{partnerOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label></div>
    {selectedPartner && <><button type="button" className="secondary" onClick={add} disabled={!products.some((item) => !rows.some((row) => row.productId === item.id))}>+ {p.language === 'it' ? 'Aggiungi prodotto' : 'Add product'}</button>
    {rows.map((row, index) => {
      const selected = allSmart.find((item) => item.id === row.productId);
      return <div className="form-grid" key={row.id || index} style={{ alignItems: 'end' }}>
        <label><span>{p.language === 'it' ? 'Prodotto Adaptive Dimming' : 'Adaptive Dimming product'}</span><select value={row.productId || ''} onChange={(e) => change(index, 'productId', e.target.value)}><option value="">{p.language === 'it' ? '-- seleziona prodotto --' : '-- select product --'}</option>{products.filter((item) => item.id === row.productId || !rows.some((other, otherIndex) => otherIndex !== index && other.productId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} {item.supplierSku ? \`· \${item.supplierSku}\` : ''}</option>)}</select></label>
        <label><span>{p.language === 'it' ? 'Quantità' : 'Quantity'}</span><input type="number" min="0" step="1" value={row.quantity ?? 0} onChange={(e) => change(index, 'quantity', numberValue(e.target.value))} /></label>
        <div><small className="hint">{selected ? \`\${selected.supplier || selected.vendor || ''}\${selected.supplierSku ? \` · \${selected.supplierSku}\` : ''}\` : ''}</small></div>
        <div><button type="button" className="danger secondary" onClick={() => remove(index)}>{p.language === 'it' ? 'Rimuovi' : 'Remove'}</button></div>
      </div>;
    })}</>}
  </div>;
}`;
s = s.slice(0, selectorStart) + selector + s.slice(solutionStart);

s = s.replace('<PartnerEquipmentSelector p={p} update={update} cmsPartner={resolveCmsPartner(p)} />', '<PartnerEquipmentSelector p={p} update={update} />');

const dashStart = s.indexOf('function CmsPartnerDashboard(');
const partnerTableStart = s.indexOf('\nfunction PartnerTable(', dashStart);
if (dashStart < 0 || partnerTableStart < 0) throw new Error('CmsPartnerDashboard block not found');
const dashboard = `function CmsPartnerDashboard({ projects, money }) {
  const options = technologyPartnerOptions(projects);
  const [partner,setPartner] = useState(options[0] || '');
  const activePartner = options.includes(partner) ? partner : (options[0] || '');
  useEffect(() => { if (activePartner !== partner) setPartner(activePartner); }, [activePartner, partner]);
  const cmsPartners = new Set(cmsPartnerOptions(projects));
  const adaptivePartners = new Set(adaptiveDimmingPartnerOptions(projects));
  const role = cmsPartners.has(activePartner) ? 'CMS / Lighting Control' : adaptivePartners.has(activePartner) ? 'Adaptive Dimming' : 'Partner';
  const totals = partnerTotals(projects,activePartner);
  return <><Card title="Partners"><div className="form-grid"><Field label="Partner" value={activePartner} onChange={setPartner}>{options.map((name) => <option key={name} value={name}>{name}</option>)}</Field><Field label="Role" value={role} onChange={() => {}} disabled><option value={role}>{role}</option></Field></div></Card><div className="kpis"><Kpi label="Role" value={role} /><Kpi label="Municipalities" value={totals.municipalities} /><Kpi label="Projects" value={totals.projects} /><Kpi label="Luminaires" value={totals.luminaires} /><Kpi label="LCUs" value={totals.lcus} /><Kpi label="ARR" value={money(totals.arr)} /><Kpi label="Contract value" value={money(totals.totalContractValue)} /></div><Card title={activePartner + ' · ' + role}><PartnerTable rows={totals.rows} money={money} /></Card></>;
}`;
s = s.slice(0, dashStart) + dashboard + s.slice(partnerTableStart);

const reportsStart = s.indexOf('function PartnerReports(');
const catalogueStart = s.indexOf('\nfunction Catalogue(', reportsStart);
if (reportsStart < 0 || catalogueStart < 0) throw new Error('PartnerReports block not found');
const reports = `function PartnerReports({ projects, p, money }) {
  const cmsPartners = cmsPartnerOptions(projects);
  const adaptivePartners = adaptiveDimmingPartnerOptions(projects);
  const partnerKeys = [...new Set(['VIMALUX', ...cmsPartners, ...adaptivePartners])];
  const [scope,setScope] = useState('portfolio');
  const [projectId,setProjectId] = useState(p.id);
  const reportProjects = scope === 'project' ? projects.filter((project) => project.id === projectId) : projects;
  return <div className="cards-grid"><Card className="partner-scope-card" title={p.language === 'it' ? 'Livello report partner' : 'Partner report level'}><div className="partner-scope-controls"><Field label={p.language === 'it' ? 'Vista' : 'View'} value={scope} onChange={setScope}><option value="portfolio">{p.language === 'it' ? 'Portafoglio completo' : 'Full portfolio'}</option><option value="project">{p.language === 'it' ? 'Singolo progetto' : 'Single project'}</option></Field>{scope === 'project' && <Field label={p.language === 'it' ? 'Progetto' : 'Project'} value={projectId} onChange={setProjectId}>{projects.map((project) => <option key={project.id} value={project.id}>{project.customer.name || project.project.name} · {project.project.businessCaseId}</option>)}</Field>}</div></Card>{partnerKeys.map((key) => { const totals = partnerTotals(reportProjects,key); const row = totals.rows[0]; const role = cmsPartners.includes(key) ? 'CMS / Lighting Control' : adaptivePartners.includes(key) ? 'Adaptive Dimming' : 'VIMALUX'; return <Card title={key + ' · ' + role} key={key}><div className="breakdown"><div><span>Role</span><span></span><strong>{role}</strong></div><div><span>Projects</span><span></span><strong>{totals.projects}</strong></div>{scope === 'project' && row && <><div><span>{p.language === 'it' ? 'Progetto' : 'Project'}</span><span></span><strong>{row.project}</strong></div><div><span>{p.language === 'it' ? 'Apparecchi' : 'Luminaires'}</span><span></span><strong>{row.luminaires}</strong></div></>}<div><span>Business value</span><span></span><strong>{money(totals.totalContractValue)}</strong></div><div><span>ARR</span><span></span><strong>{money(totals.arr)}</strong></div></div><button className="primary" onClick={() => generatePartnerPdf(key,reportProjects,p.language,p.project.currency)}>{p.language === 'it' ? 'Genera report partner' : 'Generate partner report'}</button></Card>; })}</div>;
}`;
s = s.slice(0, reportsStart) + reports + s.slice(catalogueStart);

s = s.replaceAll('CMS Partners', 'Partners');
s = s.replaceAll('PowerAiD', 'Adaptive Dimming');

fs.writeFileSync(path, s);
