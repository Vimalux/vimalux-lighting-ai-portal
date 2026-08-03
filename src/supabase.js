import { createClient } from "@supabase/supabase-js";
import { mergeProjectStates } from "./projectSync.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function loadCloudState(localProjects, includeLocalProjects = true) {
  const [{ data: projectRows, error: projectError }, { data: catalogue, error: catalogueError }] = await Promise.all([
    supabase.from("intelligence_projects").select("id,data,updated_at").order("updated_at", { ascending: true }),
    supabase.from("intelligence_catalogue").select("led,smart").eq("id", "master").maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (catalogueError) throw catalogueError;
  if (!projectRows?.length) {
    await saveCloudState(localProjects);
    return localProjects;
  }
  const masterCatalogue = catalogue ? { led: catalogue.led || [], smart: catalogue.smart || [] } : null;
  const cloudProjects = projectRows.map((row) => ({ ...row.data, id: row.id, updatedAt: row.data?.updatedAt || row.updated_at, ...(masterCatalogue ? { catalogue: masterCatalogue } : {}) }));
  return mergeProjectStates(includeLocalProjects ? localProjects : [], cloudProjects).map((project) => masterCatalogue ? { ...project, catalogue: masterCatalogue } : project);
}

export async function saveCloudState(projects) {
  if (!projects.length) return;
  const catalogue = projects[0].catalogue;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;
  const { error: catalogueError } = await supabase.from("intelligence_catalogue").upsert({ id: "master", led: catalogue.led, smart: catalogue.smart, updated_by: userId });
  if (catalogueError) throw catalogueError;
  const rows = projects.map((project) => ({ id: project.id, data: project, updated_by: userId }));
  const { error: projectsError } = await supabase.from("intelligence_projects").upsert(rows);
  if (projectsError) throw projectsError;
}
