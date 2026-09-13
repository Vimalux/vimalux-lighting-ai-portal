const LEGACY_RPC_ERROR = /Could not find the function public\.list_business_cases without parameters in the schema cache/i;

function removeLegacyPreviewError() {
  if (typeof window === "undefined" || window.location.hostname === "app.vimalux.com") return;
  document.querySelectorAll(".sync-error, [role='alert'], .toast, [class*='toast']").forEach((node) => {
    if (LEGACY_RPC_ERROR.test(String(node.textContent || ""))) node.remove();
  });
}

if (typeof document !== "undefined") {
  const observer = new MutationObserver(removeLegacyPreviewError);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", removeLegacyPreviewError, { once: true });
  else removeLegacyPreviewError();
}
