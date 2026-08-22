import { loadCurrentProfile, saveCloudState } from "./supabase.js";

const STORAGE_KEY = "vimalux-intelligence-projects";
const MARKER = "agent-project-inputs";

const numberValue = (value) => {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readProjects = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
};

const writeProjects = (projects) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

const activeProject = () => {
  const caseId = document.querySelector("main > header small")?.textContent?.trim();
  if (!caseId) return null;
  return readProjects().find((project) =>
    project?.project?.businessCaseId === caseId ||
    project?.id === caseId ||
    project?.crm?.businessCaseRecordId === caseId,
  ) || null;
};

const languageText = (project) => {
  if (project?.language === "it") return {
    title: "Parametri progetto",
    energy: "Prezzo energia (EUR/kWh)",
    hours: "Ore operative annue",
    help: "Questi valori valgono solo per questo Business Case. Se non modificati, restano i valori predefiniti VIMALUX.",
    save: "Salva parametri progetto",
    saving: "Salvataggio…",
    saved: "Salvato",
    error: "Errore durante il salvataggio",
  };
  if (project?.language === "da") return {
    title: "Projektparametre",
    energy: "Energipris (EUR/kWh)",
    hours: "Årlige brændetimer",
    help: "Værdierne gælder kun dette Business Case. Uændret anvendes VIMALUX-standardværdierne.",
    save: "Gem projektparametre",
    saving: "Gemmer…",
    saved: "Gemt",
    error: "Fejl ved gemning",
  };
  return {
    title: "Project parameters",
    energy: "Energy price (EUR/kWh)",
    hours: "Annual operating hours",
    help: "These values apply only to this Business Case. If unchanged, the VIMALUX defaults remain in use.",
    save: "Save project parameters",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed",
  };
};

const cards = () => [...document.querySelectorAll(`[data-${MARKER}]`)];
const dedupeCards = () => {
  const all = cards();
  all.slice(1).forEach((node) => node.remove());
  return all[0] || null;
};

let observer = null;
let profilePromise = null;
let cachedProfile = null;
const getProfile = async () => {
  if (cachedProfile) return cachedProfile;
  if (!profilePromise) {
    profilePromise = loadCurrentProfile()
      .then((profile) => {
        cachedProfile = profile;
        return profile;
      })
      .catch((error) => {
        profilePromise = null;
        throw error;
      });
  }
  return profilePromise;
};

let rendering = false;
const render = async () => {
  if (rendering) return;
  rendering = true;
  try {
    const main = document.querySelector("main");
    if (!main) return;

    const heading = main.querySelector("header h1")?.textContent?.trim();
    const customerPage = ["Cliente e Progetto", "Customer and Project", "Kunde og projekt"].includes(heading);
    let existing = dedupeCards();
    if (!customerPage) {
      cards().forEach((node) => node.remove());
      return;
    }

    let profile;
    try {
      profile = await getProfile();
    } catch {
      return;
    }
    if (profile?.role !== "agent") {
      cards().forEach((node) => node.remove());
      observer?.disconnect();
      return;
    }

    const project = activeProject();
    if (!project) return;
    const text = languageText(project);
    const renderKey = `${project.id}|${project.language}`;

    existing = dedupeCards();
    if (existing?.dataset.projectInputsKey === renderKey) return;

    let card = existing;
    if (!card) {
      card = document.createElement("section");
      card.className = "card";
      card.setAttribute(`data-${MARKER}`, "true");
      const contentRoot = main.querySelector(":scope > .two-col") || main.querySelector(".two-col");
      if (contentRoot?.parentNode) contentRoot.parentNode.insertBefore(card, contentRoot.nextSibling);
      else main.appendChild(card);
    }
    card.dataset.projectInputsKey = renderKey;

    card.innerHTML = `
      <h2>${text.title}</h2>
      <div class="form-grid">
        <label><span>${text.energy}</span><input data-agent-energy inputmode="decimal" value="${Number(project.assumptions?.energyPrice ?? 0)}"></label>
        <label><span>${text.hours}</span><input data-agent-hours inputmode="numeric" value="${Number(project.assumptions?.operatingHours ?? 0)}"></label>
      </div>
      <p class="muted">${text.help}</p>
      <div class="import-actions"><button class="primary" data-agent-save>${text.save}</button><span data-agent-status></span></div>
    `;

    const saveButton = card.querySelector("[data-agent-save]");
    saveButton?.addEventListener("click", async () => {
      const energyPrice = numberValue(card.querySelector("[data-agent-energy]")?.value);
      const operatingHours = Math.max(0, Math.round(numberValue(card.querySelector("[data-agent-hours]")?.value)));
      const status = card.querySelector("[data-agent-status]");
      if (energyPrice <= 0 || operatingHours <= 0) {
        if (status) status.textContent = text.error;
        return;
      }

      if (status) status.textContent = text.saving;
      if (saveButton) saveButton.disabled = true;
      try {
        const projects = readProjects();
        const changedAt = new Date().toISOString();
        const updatedProjects = projects.map((item) => {
          if (item.id !== project.id) return item;
          return {
            ...item,
            updatedAt: changedAt,
            assumptions: {
              ...(item.assumptions || {}),
              energyPrice,
              operatingHours,
            },
          };
        });
        const updated = updatedProjects.find((item) => item.id === project.id);
        if (!updated) throw new Error("Active Business Case not found");
        writeProjects(updatedProjects);
        await saveCloudState([updated]);
        if (status) status.textContent = text.saved;
        window.setTimeout(() => window.location.reload(), 350);
      } catch (error) {
        if (status) status.textContent = `${text.error}: ${error.message}`;
        if (saveButton) saveButton.disabled = false;
      }
    });
  } finally {
    rendering = false;
  }
};

let scheduled = false;
const schedule = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    render();
  });
};

if (typeof window !== "undefined") {
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", schedule);
  schedule();
}
