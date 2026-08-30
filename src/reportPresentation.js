export const PDF_FONT = "helvetica";

const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function reportNumber(value, digits = 0, lang = "en") {
  return new Intl.NumberFormat(lang === "it" ? "it-IT" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(safeNumber(value)).replace(/\u00a0|\u202f/g, " ");
}

export function reportMoney(value, lang = "en") {
  const formatted = reportNumber(value, 0, lang);
  return lang === "it" ? `${formatted} €` : `€${formatted}`;
}

export function pdfSafeText(value) {
  return String(value ?? "")
    .replace(/[→⇒➜➝]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•·]/g, "|")
    .replace(/×/g, "x")
    .replace(/CO₂/g, "CO2")
    .normalize("NFKC");
}

export function alignedTable(alignments = {}) {
  const columnStyles = {};
  Object.entries(alignments).forEach(([index, halign]) => {
    columnStyles[index] = { ...(columnStyles[index] || {}), halign };
  });

  return {
    columnStyles,
    didParseCell(data) {
      const alignment = alignments[data.column.index];
      if (alignment) data.cell.styles.halign = alignment;
    },
  };
}

export function mergeTableHooks(...hooks) {
  return (data) => {
    hooks.filter(Boolean).forEach((hook) => hook(data));
  };
}

export function needsNewPdfPage(currentY, requiredHeight, footerStartY = 278, safetyGap = 6) {
  return safeNumber(currentY) + Math.max(0, safeNumber(requiredHeight)) > footerStartY - safetyGap;
}

export function buildCustomerCapexRows(project, totalCapex, lang = "en", expectedAdditionalCapex = null, tolerance = 1) {
  const it = lang === "it";
  const additions = (Array.isArray(project?.additionalCosts) ? project.additionalCosts : [])
    .filter((item) => String(item?.costType || "capex").toLowerCase() === "capex")
    .map((item) => {
      const quantity = Math.max(0, safeNumber(item?.quantity));
      const unitSalesPrice = Math.max(0, safeNumber(item?.unitSalesPrice));
      return {
        ...item,
        quantity,
        unitSalesPrice,
        total: quantity * unitSalesPrice,
      };
    })
    .filter((item) => item.total > 0);

  const additionsTotal = additions.reduce((sum, item) => sum + item.total, 0);
  if (expectedAdditionalCapex != null && Number.isFinite(Number(expectedAdditionalCapex)) && Math.abs(additionsTotal - Number(expectedAdditionalCapex)) > tolerance) {
    throw new Error(`Additional CAPEX does not reconcile with Business Case summary: ${additionsTotal} vs ${Number(expectedAdditionalCapex)}.`);
  }

  const numericTotalCapex = Math.max(0, safeNumber(totalCapex));
  const baseCapex = numericTotalCapex - additionsTotal;
  if (baseCapex < -tolerance) {
    throw new Error(`Customer CAPEX breakdown exceeds total CAPEX by ${Math.abs(baseCapex).toFixed(2)}.`);
  }

  const rows = [];
  if (baseCapex > tolerance) {
    rows.push([
      it ? "Fornitura base LED / Smart / logistica e voci standard" : "Base LED / Smart / logistics and standard items",
      "",
      "",
      "",
      reportMoney(baseCapex, lang),
    ]);
  }

  additions.forEach((item) => {
    const description = pdfSafeText(String(item.description || item.note || (it ? "Voce aggiuntiva" : "Additional item")).trim());
    const unit = pdfSafeText(String(item.unit || "").trim());
    rows.push([
      description,
      reportNumber(item.quantity, 0, lang),
      unit,
      reportMoney(item.unitSalesPrice, lang),
      reportMoney(item.total, lang),
    ]);
  });

  rows.push([
    it ? "CAPEX totale" : "Total CAPEX",
    "",
    "",
    "",
    reportMoney(numericTotalCapex, lang),
  ]);
  return { rows, additionsCount: additions.length, additionsTotal, baseCapex: Math.max(0, baseCapex) };
}