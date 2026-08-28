export async function deleteProjectRow(client, projectId) {
  if (!client) return;
  const { error: deleteError } = await client
    .from("intelligence_projects")
    .delete()
    .eq("id", projectId);
  if (deleteError) throw deleteError;

  const { data: remaining, error: verifyError } = await client
    .from("intelligence_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (verifyError) throw verifyError;
  if (remaining) throw new Error("Project deletion was not permitted by the database.");
}
