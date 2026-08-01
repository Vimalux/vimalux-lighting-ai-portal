const STORAGE_KEY = "vml-ui-language";

const translations = {
  "PRELIMINARY BUSINESS CASE": "BUSINESS CASE PRELIMINARE",
  "ACTIVE PROJECT": "PROGETTO ATTIVO",
  "Projects": "Progetti",
  "Customer & Project": "Cliente e progetto",
  "Existing Lighting": "Illuminazione esistente",
  "Solution": "Soluzione",
  "Project Pricing": "Prezzi di progetto",
  "Assumptions": "Assunzioni",
  "Business Case": "Business case",
  "Report": "Rapporto",
  "Admin": "Amministrazione",
  "Review report": "Rivedi rapporto",
  "Customer": "Cliente",
  "Project": "Progetto",
  "Customer / municipality": "Cliente / Comune",
  "Province": "Provincia",
  "Region": "Regione",
  "Country": "Paese",
  "Contact person": "Referente",
  "Title": "Ruolo",
  "Email": "Email",
  "Phone": "Telefono",
  "Project name": "Nome progetto",
  "Business Case ID": "ID business case",
  "Sales person": "Consulente VIMALUX",
  "Date": "Data",
  "Current decision": "Valutazione attuale",
  "Annual customer net": "Beneficio netto annuo cliente",
  "Generate business case PDF": "Genera PDF business case",
  "Preliminary Business Case Report": "Rapporto preliminare di fattibilità economica",
  "Decision": "Valutazione",
  "Annual net benefit": "Beneficio netto annuo",
  "Payback": "Tempo di ritorno"
};

function currentLanguage() {
  return localStorage.getItem(STORAGE_KEY) || "it";
}

function persistProjectLanguage(language) {
  try {
    const projects = JSON.parse(localStorage.getItem("vml-bc-projects") || "[]");
    const activeId = localStorage.getItem("vml-bc-active");
    const updated = projects.map((project) => {
      if (project.id !== activeId && activeId) return project;
      return {
        ...project,
        project: { ...(project.project || {}), language }
      };
    });
    localStorage.setItem("vml-bc-projects", JSON.stringify(updated));
  } catch {
    // Keep the interface usable even when old local project data is malformed.
  }
}

function translateDocument(language) {
  document.documentElement.lang = language;
  if (language !== "it") return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const value = node.nodeValue?.trim();
    if (!value) continue;
    if (translations[value]) node.nodeValue = node.nodeValue.replace(value, translations[value]);
  }
}

function installSelector() {
  if (document.getElementById("vml-language-selector")) return;

  const wrap = document.createElement("div");
  wrap.id = "vml-language-selector";
  wrap.style.cssText = "position:fixed;top:14px;right:18px;z-index:9999;background:#fff;border:1px solid #ccd7d9;border-radius:10px;padding:7px 10px;box-shadow:0 4px 14px rgba(0,0,0,.08);font:600 14px Arial,sans-serif";

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Language");
  select.style.cssText = "border:0;background:transparent;font:inherit;outline:none;cursor:pointer";
  select.innerHTML = '<option value="it">Italiano</option><option value="en">English</option>';
  select.value = currentLanguage();
  select.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEY, select.value);
    persistProjectLanguage(select.value);
    window.location.reload();
  });

  wrap.appendChild(select);
  document.body.appendChild(wrap);
}

function run() {
  installSelector();
  translateDocument(currentLanguage());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", run, { once: true });
} else {
  run();
}

const observer = new MutationObserver(() => {
  installSelector();
  translateDocument(currentLanguage());
});
observer.observe(document.documentElement, { childList: true, subtree: true });
