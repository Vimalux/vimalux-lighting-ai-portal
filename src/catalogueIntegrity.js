export function catalogueWithHistoricalSelections(project = {}, masterCatalogue = null) {
  if (!masterCatalogue) return project?.catalogue || null;

  const masterLed = Array.isArray(masterCatalogue.led) ? masterCatalogue.led : [];
  const masterSmart = Array.isArray(masterCatalogue.smart) ? masterCatalogue.smart : [];
  const snapshotLed = Array.isArray(project?.catalogue?.led) ? project.catalogue.led : [];
  const selectedIds = new Set(
    (Array.isArray(project?.groups) ? project.groups : [])
      .map((group) => String(group?.proposedProductId || "").trim())
      .filter(Boolean),
  );
  const masterIds = new Set(masterLed.map((product) => String(product?.id || "").trim()).filter(Boolean));

  const historicalLed = snapshotLed
    .filter((product) => {
      const id = String(product?.id || "").trim();
      return id && selectedIds.has(id) && !masterIds.has(id);
    })
    .map((product) => ({
      ...product,
      active: false,
      historicalOnly: true,
    }));

  return {
    ...masterCatalogue,
    led: [...masterLed, ...historicalLed],
    smart: masterSmart,
  };
}

export function catalogueForMasterSave(catalogue = {}) {
  return {
    ...catalogue,
    led: (Array.isArray(catalogue?.led) ? catalogue.led : []).filter((product) => !product?.historicalOnly),
    smart: Array.isArray(catalogue?.smart) ? catalogue.smart : [],
  };
}
