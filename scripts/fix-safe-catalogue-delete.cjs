const fs = require('fs');

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      if (source.includes(after)) continue;
      throw new Error(`Safe catalogue delete patch target not found in ${path}: ${before.slice(0, 90)}`);
    }
    source = source.replace(before, after);
  }
  fs.writeFileSync(path, source);
}

patch('src/App.jsx', [[
  '<CatalogueExtended p={project} update={update} />',
  '<CatalogueExtended p={project} update={update} projects={projects} />'
]]);

patch('src/CatalogueExtended.jsx', [
  [
    'export default function CatalogueExtended({ p, update }) {',
    'export default function CatalogueExtended({ p, update, projects = [] }) {'
  ],
  [
`  const remove = (kind, index) => {\n    if (confirm(it ? "Eliminare questo prodotto dal catalogo?" : "Delete this product from the catalogue?")) {\n      update(["catalogue", kind], p.catalogue[kind].filter((_, i) => i !== index));\n    }\n  };`,
`  const remove = (kind, index) => {\n    const item = p.catalogue?.[kind]?.[index];\n    if (!item) return;\n    if (kind === "led") {\n      if (item.active !== false) {\n        alert(it ? "Disattivare il prodotto prima di eliminarlo." : "Deactivate the product before deleting it.");\n        return;\n      }\n      const references = (projects || []).filter((project) =>\n        (project.groups || []).some((group) => group.proposedProductId === item.id)\n      );\n      if (references.length) {\n        const names = references.map((project) => project.project?.name || project.name || project.project?.businessCaseId || "Business Case").join(", ");\n        alert(it\n          ? `Impossibile eliminare ${item.id}: ancora utilizzato in ${references.length} Business Case (${names}).`\n          : `Cannot delete ${item.id}: still used in ${references.length} Business Case(s) (${names}).`);\n        return;\n      }\n    }\n    if (confirm(it ? "Eliminare definitivamente questo prodotto dal catalogo?" : "Permanently delete this product from the catalogue?")) {\n      update(["catalogue", kind], p.catalogue[kind].filter((_, i) => i !== index));\n    }\n  };`
  ],
  [
    '<td><button className="danger" onClick={() => remove("led", index)}>{it ? "Elimina" : "Delete"}</button></td>',
    '<td>{source.active === false ? <button className="danger" onClick={() => remove("led", index)}>{it ? "Elimina" : "Delete"}</button> : <span className="catalogue-readonly">—</span>}</td>'
  ]
]);

console.log('Safe catalogue delete patch applied');
