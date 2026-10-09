import { calculateBusinessCase, numberValue } from "./calculations.js";
import { applyWarrantyPricing, projectWarranty } from "./warranty.js";

const positive = (value) => Math.max(0, numberValue(value));

function selectedCmsPartner(project) {
  if (!project?.solution?.smartEnabled || !project?.solution?.cmsEnabled) return "";
  const selected = (project.catalogue?.smart || []).find((item) => String(item?.id || "") === String(project.solution?.lcuProductId || ""));
  const explicit = project.solution?.cmsPartner || selected?.cmsPartner || selected?.vendor || selected?.manufacturer;
  if (String(explicit || "").trim()) return String(explicit).trim();
  const brand = String(selected?.brand || "").trim();
  if (brand && brand.toUpperCase() !== "VIMALUX") return brand;
  return "DATEK";
}

function selectedPrice(project, product, key) {
  if (!product?.id) return 0;
  const override = project?.pricing?.overrides?.[product.id]?.[key];
  return override == null || override === "" ? positive(product?.[key]) : positive(override);
}

function productCmsPartner(product) {
  return String(product?.cmsPartner || product?.partnerName || product?.supplier || product?.vendor || product?.manufacturer || product?.brand || "").trim();
}

export function buildCmsPartnerCommercial(project, result = calculateBusinessCase(applyWarrantyPricing(project)), calculatedAt = new Date().toISOString()) {
  const partner = selectedCmsPartner(project);
  if (!partner) return null;
  const normalizedPartner = partner.toUpperCase();
  const smart = project?.catalogue?.smart || [];
  const byId = id => smart.find((item) => String(item?.id || "") === String(id || ""));
  const partnerMatches = product => {
    const value = productCmsPartner(product).toUpperCase();
    return !value || value === normalizedPartner || (value === "VIMALUX" && normalizedPartner === "DATEK");
  };
  const products = [];
  const lcus = positive(result.lcuQuantity);
  const lcu = byId(project?.solution?.lcuProductId);
  const hardwareRevenue = lcus > 0 && lcu && partnerMatches(lcu) ? lcus * selectedPrice(project, lcu, "salesPrice") : 0;
  const implementationRevenue = lcus > 0 && lcu && partnerMatches(lcu) ? lcus * selectedPrice(project, lcu, "implementationSalesPrice") : 0;
  if (lcus > 0) products.push(`LCU/nodes × ${Math.round(lcus).toLocaleString("it-IT")}`);

  const panelEnabled = Boolean(project?.solution?.panelEquipmentEnabled);
  const panelSelections = [
    ["gatewayProductId", "gatewayQuantity", "Gateway"],
    ["antennaProductId", "antennaQuantity", "Antenna"],
    ["meterProductId", "meterQuantity", "Energy meter"],
  ];
  let panelRevenue = 0;
  let gatewayAnnual = 0;
  for (const [productKey, quantityKey, fallbackLabel] of panelSelections) {
    const quantity = panelEnabled ? positive(project?.solution?.[quantityKey]) : 0;
    const product = byId(project?.solution?.[productKey]);
    if (!(quantity > 0) || !product || !partnerMatches(product)) continue;
    panelRevenue += quantity * (selectedPrice(project, product, "salesPrice") + selectedPrice(project, product, "implementationSalesPrice"));
    if (quantityKey === "gatewayQuantity") gatewayAnnual += quantity * selectedPrice(project, product, "annualSalesPrice");
    products.push(`${product.name || fallbackLabel} × ${Math.round(quantity).toLocaleString("it-IT")}`);
  }

  let partnerEquipmentRevenue = 0;
  let partnerEquipmentAnnual = 0;
  for (const selection of project?.solution?.partnerEquipment || []) {
    const quantity = positive(selection?.quantity);
    const product = byId(selection?.productId);
    if (!(quantity > 0) || !product || !partnerMatches(product)) continue;
    const roles = Array.isArray(product.partnerRoles) ? product.partnerRoles : [product.partnerRole].filter(Boolean);
    const selectedRole = String(selection?.partnerRole || roles[0] || "").toUpperCase();
    if (selectedRole !== "CMS") continue;
    partnerEquipmentRevenue += quantity * (selectedPrice(project, product, "salesPrice") + selectedPrice(project, product, "implementationSalesPrice"));
    partnerEquipmentAnnual += quantity * selectedPrice(project, product, "annualSalesPrice");
    products.push(`${product.name || "CMS equipment"} × ${Math.round(quantity).toLocaleString("it-IT")}`);
  }

  const cmsAnnual = positive(result.cmsRevenue);
  const annualRevenue = cmsAnnual + gatewayAnnual + partnerEquipmentAnnual;
  const contractYears = Math.max(1, Math.round(positive(result.serviceAgreementPeriod) || positive(project?.assumptions?.contractYears) || 1));
  const oneOffRevenue = hardwareRevenue + implementationRevenue + panelRevenue + partnerEquipmentRevenue;
  return {
    source: "intelligence",
    syncedAt: calculatedAt,
    partner,
    businessCaseCode: project?.project?.businessCaseId || "",
    businessCaseRecordId: project?.crm?.businessCaseRecordId || "",
    lcus,
    products,
    hardwareRevenue,
    implementationRevenue,
    panelRevenue,
    partnerEquipmentRevenue,
    oneOffRevenue,
    cmsAnnual,
    gatewayAnnual,
    partnerEquipmentAnnual,
    annualRevenue,
    contractYears,
    contractValue: oneOffRevenue + annualRevenue * contractYears,
  };
}

export function buildBusinessCaseSnapshot(project, calculatedAt = new Date().toISOString()) {
  const result = calculateBusinessCase(applyWarrantyPricing(project));
  const warranty = projectWarranty(project);
  const existingLuminaires = positive(result.totalQuantity);
  const upgradeLuminaires = positive(result.upgradedQuantity);
  const smartConnectedLuminaires = positive(result.lcuQuantity);
  const energyPrice = positive(project.assumptions?.energyPrice);
  const projectLineageId = project.crm?.projectLineageId || project.project?.projectLineageId || "";
  const cmsPartner = selectedCmsPartner(project);
  const partnerCommercial = buildCmsPartnerCommercial(project, result, calculatedAt);
  const legacyKpis = project.importedCommercial?.standardKpis && typeof project.importedCommercial.standardKpis === "object"
    ? project.importedCommercial.standardKpis
    : null;
  const calculated = {
    source: "VIMALUX Intelligence calculation engine",
    sourceStatus: "calculated",
    version: Number(project.version) || 1,
    calculatedAt,
    businessCaseId: project.project?.businessCaseId || "",
    projectLineageId,

    existingLuminaires,
    upgradeLuminaires,
    smartConnectedLuminaires,
    upgradeCoveragePct: existingLuminaires ? upgradeLuminaires / existingLuminaires * 100 : 0,
    contractYears: positive(result.serviceAgreementPeriod),
    warrantyYears: warranty.selectedYears,
    warrantyUpliftPercent: warranty.isExtended ? warranty.upliftPercentSnapshot : 0,

    capex: result.totalCapex,
    annualContractRevenue: result.customerAnnualPayment,
    annualOpex: result.totalAnnualOpex,
    annualCustomerPayment: result.customerAnnualPayment,
    monthlyCustomerPayment: result.customerMonthlyPayment,
    tcv: result.totalContractRevenue,
    arr: result.annualRecurringRevenue,
    mrr: result.monthlyRecurringRevenue ?? result.annualRecurringRevenue / 12,
    annualCustomerNetBenefit: result.customerCashAnnualNetBenefit ?? result.customerAnnualNetBenefit,
    annualCustomerNetBenefitExclVat: result.customerAnnualNetBenefit,
    annualCustomerPaymentGross: result.customerGrossAnnualPayment ?? result.customerAnnualPayment,
    monthlyCustomerPaymentGross: result.customerGrossMonthlyPayment ?? result.customerMonthlyPayment,
    paybackYears: result.payback,
    npv: result.customerCashNpv ?? result.npv,
    npvExclVat: result.npv,
    lifecycleResult: result.customerCashLifecycleResult ?? result.lifecycleResult,

    annualEnergyCostBefore: positive(result.baselineKwh) * energyPrice,
    annualEnergyCostAfter: positive(result.finalKwh) * energyPrice,
    annualEnergySavingEUR: positive(result.energySaving),
    energySavingKwh: Math.max(0, result.baselineKwh - result.finalKwh),
    energyReductionPct: result.energyReductionPercent,
    co2ReductionTons: result.co2ReductionKg / 1000,

    smartNodeCount: smartConnectedLuminaires,
    cmsPartner,
    partnerCommercial,
    datekArr: result.cmsRevenue,
    datekContractValue: result.cmsRevenue && result.serviceAgreementPeriod
      ? Array.from({ length: result.serviceAgreementPeriod }, (_, index) => result.cmsRevenue * Math.pow(1 + positive(project.assumptions?.opexEscalation) / 100, index)).reduce((sum, value) => sum + value, 0)
      : 0,
    powerAidCustomerFee: result.powerAidCustomerFee,
    powerAidSupplierCost: result.powerAidSupplierCost,
    powerAidVimaluxMargin: result.powerAidVimaluxMargin,
    goStatus: result.customerCashDecisionStatus ?? result.customerDecisionStatus,
  };
  if (!legacyKpis) return calculated;
  const imported = Object.fromEntries(Object.entries(legacyKpis).filter(([, value]) => value != null && Number.isFinite(Number(value))));
  const merged = {
    ...calculated,
    ...imported,
    projectLineageId,
    source: "VIMALUX Legacy Excel CRM_IMPORT",
    sourceStatus: "calculated",
    calculatedAt,
  };
  merged.smartNodeCount = merged.smartConnectedLuminaires ?? calculated.smartNodeCount;
  merged.annualCustomerPayment = merged.annualContractRevenue ?? calculated.annualCustomerPayment;
  merged.monthlyCustomerPayment = merged.annualContractRevenue != null ? merged.annualContractRevenue / 12 : calculated.monthlyCustomerPayment;
  return merged;
}

export function syncBusinessCaseResult(project, calculatedAt) {
  const businessCase = buildBusinessCaseSnapshot(project, calculatedAt);
  return {
    ...project,
    crm: {
      ...(project.crm || {}),
      projectLineageId: businessCase.projectLineageId || project.crm?.projectLineageId || "",
      goStatus: businessCase.goStatus,
      businessCase,
    },
  };
}

export function applyAuthoritativeBusinessCase(project, values = {}) {
  const current = project.crm?.businessCase || {};
  const projectLineageId = values.projectLineageId || current.projectLineageId || project.crm?.projectLineageId || project.project?.projectLineageId || "";
  const businessCase = {
    ...current,
    ...values,
    projectLineageId,
    source: values.source || "VIMALUX Intelligence sync",
    sourceStatus: values.sourceStatus || "synced",
    version: Number(values.version ?? current.version ?? project.version) || 1,
    calculatedAt: values.calculatedAt || new Date().toISOString(),
    businessCaseId: values.businessCaseId || project.project?.businessCaseId || "",
  };
  return {
    ...project,
    crm: {
      ...(project.crm || {}),
      projectLineageId,
      goStatus: businessCase.goStatus || project.crm?.goStatus || "",
      businessCase,
    },
  };
}
