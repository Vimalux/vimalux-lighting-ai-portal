const textValue = (value) => String(value ?? "").trim();

export function businessCaseCodeFromText(value) {
  const text = textValue(value);
  if (!text) return "";
  return text.match(/\bBC-[A-Z0-9-]+\b/i)?.[0] || "";
}

function projectReferences(project = {}) {
  return {
    ids: [project?.id, project?.crm?.businessCaseRecordId]
      .map(textValue)
      .filter(Boolean),
    codes: [project?.project?.businessCaseId, project?.crm?.businessCase?.businessCaseId]
      .map((value) => textValue(value).toUpperCase())
      .filter(Boolean),
  };
}

export function projectMatchesBusinessCaseReference(project, reference) {
  const raw = textValue(reference);
  if (!raw) return false;
  const code = businessCaseCodeFromText(raw) || raw;
  const refs = projectReferences(project);
  return refs.ids.includes(raw) || refs.codes.includes(code.toUpperCase());
}

export function resolveProjectByReference(projects = [], reference = "") {
  const rows = Array.isArray(projects) ? projects : [];
  return rows.find((project) => projectMatchesBusinessCaseReference(project, reference)) || null;
}

export function resolveActiveProjectIndex(
  projects = [],
  { urlBusinessCaseId = "", headerText = "", storedBusinessCaseId = "" } = {},
) {
  const rows = Array.isArray(projects) ? projects : [];
  if (!rows.length) return -1;

  const explicit = textValue(urlBusinessCaseId);
  if (explicit) {
    return rows.findIndex((project) => projectMatchesBusinessCaseReference(project, explicit));
  }

  // The rendered Business Case code is authoritative for a newly created
  // project whose URL has deliberately been cleared before React switches
  // context. Header text may be "Project name · BC-123456", so parse the code
  // rather than comparing the entire label with project.businessCaseId.
  const headerCode = businessCaseCodeFromText(headerText);
  if (headerCode) {
    return rows.findIndex((project) => projectMatchesBusinessCaseReference(project, headerCode));
  }

  const remembered = textValue(storedBusinessCaseId);
  if (remembered) {
    return rows.findIndex((project) => projectMatchesBusinessCaseReference(project, remembered));
  }

  return -1;
}
