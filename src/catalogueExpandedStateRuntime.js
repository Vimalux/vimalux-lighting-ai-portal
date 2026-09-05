const prefix = "catalogue-product-";

const businessCaseId = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("business_case_id") || params.get("opportunity_id") || "default";
  } catch {
    return "default";
  }
};

const key = () => `vimalux:catalogue-expanded:${businessCaseId()}`;

const read = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key()) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (ids) => {
  try { sessionStorage.setItem(key(), JSON.stringify([...new Set(ids)])); } catch {}
};

const rowIdFromButton = (button) => {
  const row = button?.closest?.("tr[id^='catalogue-product-']");
  return row?.id?.startsWith(prefix) ? row.id.slice(prefix.length) : "";
};

const isDetailsButton = (button) => /^(Dettagli|Details)$/i.test(String(button?.textContent || "").trim());
const isCloseButton = (button) => /^(Chiudi|Close)$/i.test(String(button?.textContent || "").trim());

document.addEventListener("click", (event) => {
  const button = event.target?.closest?.("button");
  if (!button) return;
  const id = rowIdFromButton(button);
  if (!id) return;
  const ids = read();
  if (isDetailsButton(button)) write([...ids, id]);
  else if (isCloseButton(button)) write(ids.filter((item) => item !== id));
}, true);

let restoring = false;
const restore = () => {
  if (restoring) return;
  const ids = read();
  if (!ids.length) return;
  restoring = true;
  try {
    for (const id of ids) {
      const row = document.getElementById(`${prefix}${id}`);
      if (!row) continue;
      const button = [...row.querySelectorAll("button")].find(isDetailsButton);
      if (button) button.click();
    }
  } finally {
    restoring = false;
  }
};

const observer = new MutationObserver(() => queueMicrotask(restore));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("focus", restore);
document.addEventListener("visibilitychange", () => { if (!document.hidden) restore(); });
queueMicrotask(restore);
