import { catalogueWithHistoricalSelections } from "./catalogueIntegrity.js";

export function proposalProjectWithCatalogue(row = {}, catalogue = null) {
  const project = row.intelligence_data || {};
  if (!catalogue) return project;
  const masterCatalogue = { led: catalogue.led || [], smart: catalogue.smart || [] };
  return { ...project, catalogue: catalogueWithHistoricalSelections(project, masterCatalogue) };
}
