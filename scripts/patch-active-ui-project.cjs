const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'src', 'App.jsx');
let source = fs.readFileSync(file, 'utf8');

const marker = 'const ACTIVE_UI_PROJECT_KEY = "vimalux-intelligence-active-ui-project";';
if (!source.includes(marker)) {
  source = source.replace(
    'export default function App() {\n',
    `${marker}\n\nexport default function App() {\n`,
  );
}

const oldInitializer = `  const [activeId, setActiveId] = useState(() => {\n    const requestedId = new URLSearchParams(window.location.search).get("business_case_id");\n    return findLinkedProject(initial, requestedId)?.id || initial[0].id;\n  });`;
const newInitializer = `  const [activeId, setActiveId] = useState(() => {\n    const requestedId = new URLSearchParams(window.location.search).get("business_case_id");\n    const requestedProject = findLinkedProject(initial, requestedId);\n    if (requestedProject) return requestedProject.id;\n    let rememberedId = "";\n    try { rememberedId = String(localStorage.getItem(ACTIVE_UI_PROJECT_KEY) || "").trim(); } catch (_) {}\n    return initial.some((item) => item.id === rememberedId) ? rememberedId : initial[0]?.id || "";\n  });`;
if (source.includes(oldInitializer)) source = source.replace(oldInitializer, newInitializer);
else if (!source.includes('localStorage.getItem(ACTIVE_UI_PROJECT_KEY)')) throw new Error('activeId initializer not found');

const projectStorageEffect = '  useEffect(() => localStorage.setItem("vimalux-intelligence-projects", JSON.stringify(projects)), [projects]);';
const uiStorageEffect = `${projectStorageEffect}\n  useEffect(() => {\n    if (!activeId) return;\n    try { localStorage.setItem(ACTIVE_UI_PROJECT_KEY, activeId); } catch (_) {}\n  }, [activeId]);`;
if (source.includes(projectStorageEffect) && !source.includes('localStorage.setItem(ACTIVE_UI_PROJECT_KEY, activeId)')) {
  source = source.replace(projectStorageEffect, uiStorageEffect);
}

if (!source.includes(marker)) throw new Error('ACTIVE_UI_PROJECT_KEY marker missing');
if (!source.includes('localStorage.getItem(ACTIVE_UI_PROJECT_KEY)')) throw new Error('active UI restore missing');
if (!source.includes('localStorage.setItem(ACTIVE_UI_PROJECT_KEY, activeId)')) throw new Error('active UI persist missing');

fs.writeFileSync(file, source);
console.log('Patched App.jsx with active UI project persistence');
