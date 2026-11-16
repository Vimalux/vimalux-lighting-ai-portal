import { supabase, stagingPreview } from "./supabase.js";
import { BASE_ASSUMPTIONS } from "./model.js";
import { getSharedDefaultState, setSharedDefaultState } from "./sharedDefaultState.js";

const KEY = "global";

export async function loadGlobalDefaults() {
  if (stagingPreview) {
    return setSharedDefaultState({ values: BASE_ASSUMPTIONS, revision: 1 });
  }
  if (!supabase) throw new Error("Supabase is required for Intelligence defaults");
  const { data, error } = await supabase.from("intelligence_default_settings")
    .select("values,revision").eq("id", KEY).single();
  if (error) throw new Error(`Global defaults unavailable: ${error.message}`);
  return setSharedDefaultState(data);
}

export async function saveGlobalDefaults(values) {
  if (stagingPreview) throw new Error("Saving defaults is disabled in local staging preview");
  if (!supabase) throw new Error("Supabase is required for Intelligence defaults");
  const previous = getSharedDefaultState();
  if (!previous) throw new Error("Load the global defaults before saving");
  const { data, error } = await supabase.from("intelligence_default_settings")
    .update({ values }).eq("id", KEY).eq("revision", previous.revision)
    .select("values,revision").maybeSingle();
  if (error) throw new Error(`Unable to save global defaults: ${error.message}`);
  if (!data) throw new Error("Defaults changed in another session. Reload them before saving.");
  return setSharedDefaultState(data);
}
