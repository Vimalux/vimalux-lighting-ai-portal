export function stagingAuthMode(hostname, search = "", storage) {
  if (hostname === "app.vimalux.com") return false;
  const requested = new URLSearchParams(search).get("staging_auth");
  try {
    if (requested === "1") storage?.setItem("vimalux-staging-auth", "1");
    if (requested === "0") storage?.removeItem("vimalux-staging-auth");
    return requested === "1" || (requested !== "0" && storage?.getItem("vimalux-staging-auth") === "1");
  } catch { return requested === "1"; }
}
