const fs = require('node:fs');

const path = 'src/App.jsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Official input identity patch target not found (${label})`);
  source = source.replace(before, after);
}

replaceOnce(
`  const update = (path, value) =>
    setProjects((all) => {
      if (isAgent && ["pricing", "assumptions"].includes(path[0])) return all;
      if (isAgent && path[0] === "additionalCosts") {
        if (path.length !== 1 || !Array.isArray(value)) return all;
        value = sanitizeAgentAdditionalCosts(project.additionalCosts, value);
      }
      const normalized = numeric.has(path.at(-1)) ? numberValue(value) : value;
      const changedAt = new Date().toISOString();`,
`  const update = (path, value) =>
    setProjects((all) => {
      if (isAgent && ["pricing", "assumptions"].includes(path[0])) return all;
      if (isAgent && path[0] === "additionalCosts") {
        if (path.length !== 1 || !Array.isArray(value)) return all;
        value = sanitizeAgentAdditionalCosts(project.additionalCosts, value);
      }
      const changedAt = new Date().toISOString();
      if (path[0] === "importSheet") {
        const payload = value || {};
        const isOfficial = /^ProjectInputSheet(?:_ITA)?$/i.test(String(payload.sheetName || "").trim());
        const customerName = isOfficial ? String(payload.customerName || "").trim() : "";
        const projectName = isOfficial ? String(payload.projectName || "").trim() : "";
        const importedGroups = Array.isArray(payload.groups) ? payload.groups : [];
        return all.map((item) => {
          if (item.id !== project.id) return item;
          const nextGroups = payload.mode === "append" ? [...(item.groups || []), ...importedGroups] : importedGroups;
          let next = {
            ...item,
            groups: nextGroups,
            updatedAt: changedAt,
            importedTechnical: {
              ...(item.importedTechnical || {}),
              fileName: String(payload.fileName || ""),
              sheetName: String(payload.sheetName || ""),
              importedAt: changedAt,
            },
          };
          if (customerName) next.customer = { ...(item.customer || {}), name: customerName };
          if (projectName) {
            next.project = { ...(item.project || {}), name: projectName };
            next.name = projectName;
          }
          if (isOfficial && customerName && projectName) {
            next.identitySync = {
              source: "official_input_sheet",
              importedAt: changedAt,
              fileName: String(payload.fileName || ""),
              sheetName: String(payload.sheetName || ""),
              customerName,
              projectName,
            };
          }
          return migrateProject(next);
        });
      }
      const normalized = numeric.has(path.at(-1)) ? numberValue(value) : value;`,
'atomic project update'
);

replaceOnce(
`<LightingImportModal p={p} state={importer} setState={setImporter} close={() => setImporter(null)} apply={(groups, mode) => { update(["groups"], mode === "append" ? [...p.groups, ...groups] : groups); setImporter(null); }} />`,
`<LightingImportModal p={p} state={importer} setState={setImporter} close={() => setImporter(null)} apply={(groups, mode) => { const sheet = importer.sheets[importer.sheetIndex] || {}; update(["importSheet"], { groups, mode, customerName: sheet.customerName, projectName: sheet.projectName, sheetName: sheet.name, fileName: importer.fileName }); setImporter(null); }} />`,
'official input metadata application'
);

fs.writeFileSync(path, source);
console.log('Official input sheet project identity patch applied');
