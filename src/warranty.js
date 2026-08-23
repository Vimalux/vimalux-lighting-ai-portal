export const DEFAULT_WARRANTY = Object.freeze({ standardYears: 5, extendedYears: 10, upliftPercent: 18.19 });

const n = (value, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function catalogueWarranty(catalogue = {}) {
  const source = catalogue.warranty || {};
  return {
    standardYears: Math.max(1, Math.round(n(source.standardYears, DEFAULT_WARRANTY.standardYears))),
    extendedYears: Math.max(1, Math.round(n(source.extendedYears, DEFAULT_WARRANTY.extendedYears))),
    upliftPercent: Math.max(0, n(source.upliftPercent, DEFAULT_WARRANTY.upliftPercent)),
  };
}

export function projectWarranty(project = {}) {
  const config = catalogueWarranty(project.catalogue);
  const selectedYears = Math.max(1, Math.round(n(project.solution?.warrantyYears, config.standardYears)));
  const snapshot = n(project.solution?.warrantyUpliftPercentSnapshot, config.upliftPercent);
  const isExtended = selectedYears === config.extendedYears && config.extendedYears !== config.standardYears;
  return {
    ...config,
    selectedYears,
    upliftPercentSnapshot: Math.max(0, snapshot),
    isExtended,
  };
}

export function effectiveWarrantyUplift(product = {}, project = {}) {
  const warranty = projectWarranty(project);
  if (!warranty.isExtended) return 0;
  const productOverride = product.warrantyUpliftPercent;
  return productOverride === "" || productOverride == null
    ? warranty.upliftPercentSnapshot
    : Math.max(0, n(productOverride, warranty.upliftPercentSnapshot));
}

export function applyWarrantyPricing(project = {}) {
  const warranty = projectWarranty(project);
  if (!warranty.isExtended) return project;
  return {
    ...project,
    catalogue: {
      ...(project.catalogue || {}),
      led: (project.catalogue?.led || []).map((product) => {
        const uplift = effectiveWarrantyUplift(product, project);
        return {
          ...product,
          baseSalesPrice: n(product.salesPrice, 0),
          warrantyUpliftAppliedPercent: uplift,
          salesPrice: n(product.salesPrice, 0) * (1 + uplift / 100),
        };
      }),
    },
  };
}

export function warrantyLabel(project = {}, language = "it") {
  const warranty = projectWarranty(project);
  const pct = warranty.upliftPercentSnapshot.toLocaleString(language === "it" ? "it-IT" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (language === "it") return warranty.isExtended ? `${warranty.selectedYears} anni · +${pct}%` : `${warranty.selectedYears} anni · standard`;
  return warranty.isExtended ? `${warranty.selectedYears} years · +${pct}%` : `${warranty.selectedYears} years · standard`;
}
