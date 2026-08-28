import { detectWorkbookType, readLightingWorkbook } from "./lightingImport.js";

const TARGET_KEY = "vimalux-reimport-target-id";
const PROJECTS_KEY = "vimalux-intelligence-projects";
const nativeConfirm = window.confirm.bind(window);
const nativeAlert = window.alert.bind(window);
let pendingImport = null;

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const baseName = (fileName) => String(fileName || "").replace(/\.(xlsx?|csv)$/i, "");

function loadStoredProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.projects) ? parsed.projects : []);
  } catch {
    return [];
  }
}

function fieldValue(sheet, fieldName) {
  if (!sheet) return "";
  const fieldIndex = (sheet.headers || []).findIndex((value) => normalize(value) === "field");
  const valueIndex = (sheet.headers || []).findIndex((value) => normalize(value) === "value");
  if (fieldIndex < 0 || valueIndex < 0) return "";
  const row = (sheet.rows || []).find((item) => normalize(item?.[fieldIndex]) === normalize(fieldName));
  return String(row?.[valueIndex] ?? "").trim();
}

function plannerProjectName(fileName) {
  const rawName = baseName(fileName).replace(/^AC_\d+_\d+_/i, "").replace(/_/g, " ").trim();
  const match = rawName.match(/COMUNE DI (.+?)(?: RIQUALIFICAZIONE|$)/i);
  const name = match ? match[1].trim() : rawName;
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deriveImportIdentity(sheets, file) {
  const type = detectWorkbookType(sheets);
  if (type === "noleggio") {
    const crm = sheets.find((sheet) => normalize(sheet.name) === "crm import");
    return {
      type,
      fileName: file.name,
      projectName: fieldValue(crm, "project_name") || baseName(file.name),
      customerName: fieldValue(crm, "customer_name"),
    };
  }
  if (type === "planner") {
    return { type, fileName: file.name, projectName: plannerProjectName(file.name), customerName: "" };
  }
  const first = sheets.find((sheet) => (sheet.headers || []).length) || sheets[0];
  return {
    type,
    fileName: file.name,
    projectName: String(first?.projectIdCellC6 || "").trim() || baseName(file.name),
    customerName: "",
  };
}

function selectedBusinessCase() {
  const row = document.querySelector(".project-row.selected");
  if (!row) return { name: "", businessCaseId: "" };
  return {
    name: row.querySelector(".project-select strong")?.textContent?.trim() || "",
    businessCaseId: row.querySelector(".project-select small")?.textContent?.trim() || "",
  };
}

function matchingProjects(identity) {
  const projectName = normalize(identity?.projectName);
  const customerName = normalize(identity?.customerName);
  if (!projectName) return [];
  return loadStoredProjects().filter((project) => {
    if (normalize(project?.project?.name || project?.name) !== projectName) return false;
    if (!customerName) return true;
    const candidateCustomer = normalize(project?.customer?.name);
    return !candidateCustomer || candidateCustomer === customerName;
  });
}

function importPreviewWithoutQuestion(message) {
  return String(message || "")
    .replace(/\n\nImport as a new Noleggio Operativo project\?\s*$/i, "")
    .replace(/\n\nImport and continue with pricing\?\s*$/i, "")
    .replace(/\n\nImport as a new project\?\s*$/i, "");
}

function isProjectImportConfirmation(message) {
  return /Import as a new Noleggio Operativo project\?|Import and continue with pricing\?|Import as a new project\?/i.test(String(message || ""));
}

window.confirm = function vimaluxConfirm(message) {
  if (!isProjectImportConfirmation(message)) return nativeConfirm(message);

  const identity = pendingImport;
  const preview = importPreviewWithoutQuestion(message);
  if (!identity?.projectName) {
    return nativeConfirm(`${preview}\n\nImportare il progetto?`);
  }

  const matches = matchingProjects(identity);
  if (!matches.length) {
    localStorage.removeItem(TARGET_KEY);
    return nativeConfirm(`${preview}\n\nNessun progetto esistente con questo nome. Creare un nuovo progetto "${identity.projectName}"?`);
  }

  let target = matches[0];
  if (matches.length > 1) {
    const selected = selectedBusinessCase();
    target = matches.find((candidate) =>
      selected.businessCaseId && String(candidate?.project?.businessCaseId || "").trim() === selected.businessCaseId,
    );
    if (!target || normalize(selected.name) !== normalize(identity.projectName)) {
      localStorage.removeItem(TARGET_KEY);
      nativeAlert(`Sono presenti ${matches.length} progetti con il nome "${identity.projectName}".\n\nSeleziona nell'elenco il Business Case che desideri aggiornare e importa nuovamente il file.`);
      return false;
    }
  }

  localStorage.setItem(TARGET_KEY, String(target.id));
  const businessCaseId = target?.project?.businessCaseId || target?.crm?.businessCaseRecordId || target.id;
  const approved = nativeConfirm(
    `${preview}\n\nIl progetto "${identity.projectName}" esiste già.\nBusiness Case: ${businessCaseId}\n\nAggiornare il Business Case esistente con i dati importati?`,
  );
  if (!approved) localStorage.removeItem(TARGET_KEY);
  else setTimeout(() => localStorage.removeItem(TARGET_KEY), 0);
  return approved;
};

// Analyze the file before React receives the change event. This makes the
// synchronous browser confirmation aware of the project identity in the file.
document.addEventListener("change", async (event) => {
  if (event.__vimaluxProjectImportReplay) return;
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
  const labelText = input.closest("label")?.textContent || "";
  if (!/Importa file progetto|Import project file/i.test(labelText)) return;
  const file = input.files?.[0];
  if (!file) return;

  event.stopImmediatePropagation();
  pendingImport = { fileName: file.name, projectName: baseName(file.name), customerName: "", type: "unknown" };
  try {
    const sheets = await readLightingWorkbook(file);
    pendingImport = deriveImportIdentity(sheets, file);
  } catch {
    // Let the normal importer report parsing errors; the guard only supplies identity/UI context.
  }

  const replay = new Event("change", { bubbles: true });
  replay.__vimaluxProjectImportReplay = true;
  input.dispatchEvent(replay);
}, true);
