import { supabase, supabaseConfigured } from "./supabase.js";

const LOGIN_MARKER_KEY = "vimalux-platform-login-fingerprint";
const MODULE_MARKER_PREFIX = "vimalux-platform-module:";

export function moduleFromTitle(title = "") {
  return String(title || "").toUpperCase().includes("CRM") ? "crm" : "intelligence";
}

export function loginFingerprint(session) {
  const user = session?.user;
  if (!user?.id) return "";
  return `${user.id}:${user.last_sign_in_at || "signed-in"}`;
}

function currentModule() {
  return moduleFromTitle(typeof document !== "undefined" ? document.title : "");
}

function activityDetails(module, extra = {}) {
  return {
    module,
    source: "vimalux_unified_app",
    path: typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "",
    ...extra,
  };
}

async function insertActivity(session, action, details = {}) {
  const userId = session?.user?.id;
  if (!supabaseConfigured || !supabase || !userId) return false;
  const { error } = await supabase.from("project_activity").insert({
    project_id: null,
    user_id: userId,
    action,
    details,
  });
  if (error) {
    console.warn(`[VIMALUX activity] ${action} not recorded:`, error.message);
    return false;
  }
  return true;
}

async function recordLoginOnce(session) {
  const fingerprint = loginFingerprint(session);
  if (!fingerprint || typeof localStorage === "undefined") return;
  if (localStorage.getItem(LOGIN_MARKER_KEY) === fingerprint) return;
  const module = currentModule();
  const ok = await insertActivity(session, "login", activityDetails(module, {
    auth_event: "SIGNED_IN",
    signed_in_at: session?.user?.last_sign_in_at || null,
  }));
  if (ok) localStorage.setItem(LOGIN_MARKER_KEY, fingerprint);
}

let activeSession = null;
let lastModule = null;

async function recordModuleOpen(session, force = false) {
  if (!session?.user?.id || typeof sessionStorage === "undefined") return;
  const module = currentModule();
  const markerKey = `${MODULE_MARKER_PREFIX}${session.user.id}`;
  const persistedModule = sessionStorage.getItem(markerKey);
  if (!force && module === lastModule) return;
  if (!force && !lastModule && module === persistedModule) {
    lastModule = module;
    return;
  }
  lastModule = module;
  const ok = await insertActivity(session, "module_opened", activityDetails(module));
  if (ok) sessionStorage.setItem(markerKey, module);
}

function clearTrackingMarkers(session) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(LOGIN_MARKER_KEY);
  if (typeof sessionStorage !== "undefined" && session?.user?.id) {
    sessionStorage.removeItem(`${MODULE_MARKER_PREFIX}${session.user.id}`);
  }
  lastModule = null;
}

function installTitleObserver() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const title = document.querySelector("title");
  if (!title) return;
  const observer = new MutationObserver(() => {
    if (activeSession) void recordModuleOpen(activeSession);
  });
  observer.observe(title, { childList: true, subtree: true, characterData: true });
}

function installSignOutAudit() {
  if (!supabase?.auth?.signOut || supabase.auth.__vimaluxActivityWrapped) return;
  const originalSignOut = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = async (...args) => {
    const session = activeSession || (await supabase.auth.getSession()).data.session;
    if (session) {
      await insertActivity(session, "logout", activityDetails(currentModule(), { auth_event: "SIGN_OUT_REQUEST" }));
      clearTrackingMarkers(session);
    }
    return originalSignOut(...args);
  };
  supabase.auth.__vimaluxActivityWrapped = true;
}

export function installPlatformActivityTracking() {
  if (!supabaseConfigured || !supabase || typeof window === "undefined") return;
  installSignOutAudit();
  installTitleObserver();

  supabase.auth.getSession().then(({ data }) => {
    activeSession = data.session || null;
    if (activeSession) void recordModuleOpen(activeSession);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    activeSession = session || null;
    if (event === "SIGNED_IN" && session) {
      void recordLoginOnce(session);
      void recordModuleOpen(session, true);
    }
    if (event === "SIGNED_OUT") {
      clearTrackingMarkers(session);
      activeSession = null;
    }
  });
}

installPlatformActivityTracking();
