const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const positive = (value) => Math.max(0, numberValue(value));

function isInstallationAdditionalCost(row = {}) {
  if (row.costType !== "capex") return false;
  if (row.category === "lavoro") return true;
  // Imported project estimates often use "servizi"/"altro" for installation.
  // These items belong in the installation bucket, not unexplained other costs.
  return /installazion|montagg|smaltiment|rimozion|posa in opera|installation|dismantl|removal|mounting/i
    .test(String(row.description || ""));
}

function escalatingTotal(annualValue, ratePercent, years) {
  const annual = positive(annualValue);
  const rate = numberValue(ratePercent) / 100;
  const period = Math.max(0, Math.round(numberValue(years)));
  return Array.from({ length: period }, (_, index) => annual * Math.pow(1 + rate, index))
    .reduce((sum, value) => sum + value, 0);
}

/**
 * Build the internal cost payload that Intelligence writes back to CRM.
 *
 * Ownership rules:
 * - only cost fields calculated by Intelligence are included;
 * - CRM-owned selling prices, revenue basis, margin basis, bonus and minimum-margin
 *   settings are intentionally NOT included and therefore cannot be overwritten;
 * - other_direct_costs is the reconciled residual, so the mapped CRM cost buckets
 *   always tie back to Intelligence totalDirectCosts without double counting.
 */
export function buildCrmInternalFinancials(project, result = {}) {
  const assumptions = project?.assumptions || {};
  const serviceYears = Math.max(
    1,
    Math.round(positive(result.serviceAgreementPeriod || assumptions.serviceAgreementPeriod || assumptions.contractYears || 1)),
  );
  const opexEscalation = numberValue(assumptions.opexEscalation);

  const luminaireCosts = positive(result.ledCost);
  const installationAdditionalCosts = (result.additionalCosts?.rows || [])
    .filter(isInstallationAdditionalCost)
    .reduce((sum, row) => sum + positive(row.costTotal), 0);
  const installationCosts = positive(result.implementationCost) + installationAdditionalCosts;
  const freightCosts = positive(result.freightCost);
  const agentCommission = positive(result.commissionCost);
  const financeCosts = positive(result.financingCost);

  // CRM retains the legacy `datek_costs` column name. It represents the direct
  // Smart/CMS supplier bucket: one-time Smart hardware plus CMS/connectivity
  // supplier OPEX over the service agreement period.
  const cmsContractCost = escalatingTotal(result.cmsDirectCost, opexEscalation, serviceYears);
  const connectivityContractCost = escalatingTotal(result.gatewayRecurringCost, opexEscalation, serviceYears);
  const datekCosts = positive(result.smartHardwareCost)
    + positive(result.gatewayCost)
    + positive(result.antennaCost)
    + positive(result.meterCost)
    + cmsContractCost
    + connectivityContractCost;

  // Adaptive Dimming supplier economics are already calculated over the selected
  // Adaptive service period by the core engine.
  const felicityCosts = positive(result.powerAidSupplierContractCost);

  const mappedBeforeOther = luminaireCosts
    + datekCosts
    + felicityCosts
    + installationCosts
    + freightCosts
    + agentCommission
    + financeCosts;
  const totalDirectCosts = positive(result.totalDirectCosts);
  const otherDirectCosts = Math.max(0, totalDirectCosts - mappedBeforeOther);
  // The legacy CRM cost bridge uses nominal assigned receivables, including the
  // partner discount. The internal report instead shows the present-value
  // proceeds and excludes that same discount from costs. Persist both explicitly
  // so they can be reconciled without mixing accounting bases.
  const internalReportRevenue = positive(result.vimaluxRevenue ?? result.totalContractRevenue);
  const internalReportDirectCosts = positive(result.vimaluxDirectCosts ?? result.totalDirectCosts);
  const internalReportContribution = internalReportRevenue - internalReportDirectCosts;

  return {
    schema_version: 1,
    source: "VIMALUX Intelligence calculation engine",
    total_direct_costs: totalDirectCosts,
    luminaire_costs: luminaireCosts,
    datek_costs: datekCosts,
    felicity_costs: felicityCosts,
    installation_costs: installationCosts,
    freight_costs: freightCosts,
    other_direct_costs: otherDirectCosts,
    agent_commission: agentCommission,
    finance_costs: financeCosts,
    receivables_discount: positive(result.financeReceivablesDiscount),
    internal_report_revenue: internalReportRevenue,
    internal_report_direct_costs: internalReportDirectCosts,
    internal_report_contribution: internalReportContribution,
    internal_report_margin_percent: internalReportRevenue ? internalReportContribution / internalReportRevenue * 100 : 0,
  };
}
