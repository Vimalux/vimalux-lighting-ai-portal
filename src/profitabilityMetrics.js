const numberValue = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (margin, revenue) => revenue ? margin / revenue * 100 : 0;

export function escalatingTotal(annual, ratePercent, years) {
  const value = numberValue(annual);
  const rate = numberValue(ratePercent) / 100;
  const period = Math.max(0, Math.round(numberValue(years)));
  return Array.from({ length: period }, (_, index) => value * Math.pow(1 + rate, index)).reduce((sum, item) => sum + item, 0);
}

export function internalProfitabilityMetrics(project, result) {
  const r = result || {};
  const a = project?.assumptions || {};
  const serviceYears = Math.max(1, Math.round(numberValue(r.serviceAgreementPeriod || a.serviceAgreementPeriod || a.contractYears || 1)));
  const powerAidYears = Math.max(0, Math.round(numberValue(r.powerAidServicePeriod || a.powerAidServicePeriod || 0)));
  const opexRate = numberValue(a.opexEscalation);
  const energyRate = numberValue(a.energyEscalation);

  const hardwareRevenue = numberValue(r.totalCapex);
  const hardwareDirectCost = numberValue(r.capexDirectCost) + numberValue(r.dutyCost);
  const hardwareMargin = hardwareRevenue - hardwareDirectCost;

  const cmsRevenueAnnual = numberValue(r.cmsRevenue);
  const cmsCostAnnual = numberValue(r.cmsDirectCost);
  const cmsMarginAnnual = cmsRevenueAnnual - cmsCostAnnual;
  const cmsCustomerContractValue = escalatingTotal(cmsRevenueAnnual, opexRate, serviceYears);
  const cmsSupplierContractCost = escalatingTotal(cmsCostAnnual, opexRate, serviceYears);

  const gatewayRevenueAnnual = numberValue(r.gatewayRecurringRevenue);
  const gatewayCostAnnual = numberValue(r.gatewayRecurringCost);
  const gatewayMarginAnnual = gatewayRevenueAnnual - gatewayCostAnnual;

  const otherOpexRevenueAnnual = numberValue(r.additionalAnnualOpexSales);
  const otherOpexCostAnnual = numberValue(r.additionalAnnualOpexCost);
  const otherOpexMarginAnnual = otherOpexRevenueAnnual - otherOpexCostAnnual;

  const recurringRevenueAnnual = numberValue(r.fixedAnnualOpex);
  const recurringCostAnnual = numberValue(r.annualOpexDirectCost);
  const recurringMarginAnnual = recurringRevenueAnnual - recurringCostAnnual;
  const recurringCustomerContractValue = escalatingTotal(recurringRevenueAnnual, opexRate, serviceYears);
  const recurringSupplierContractCost = escalatingTotal(recurringCostAnnual, opexRate, serviceYears);

  const adaptiveRevenueAnnual = numberValue(r.powerAidCustomerFee);
  const adaptiveCostAnnual = numberValue(r.powerAidSupplierCost);
  const adaptiveMarginAnnual = numberValue(r.powerAidVimaluxMargin || (adaptiveRevenueAnnual - adaptiveCostAnnual));
  const adaptiveCustomerContractValue = numberValue(r.powerAidContractRevenue || escalatingTotal(adaptiveRevenueAnnual, energyRate, powerAidYears));
  const adaptiveSupplierContractCost = numberValue(r.powerAidSupplierContractCost || escalatingTotal(adaptiveCostAnnual, energyRate, powerAidYears));
  const adaptiveContractMargin = adaptiveCustomerContractValue - adaptiveSupplierContractCost;

  const projectRevenue = numberValue(r.totalContractRevenue);
  const projectDirectCosts = numberValue(r.totalDirectCosts);
  const projectContribution = numberValue(r.netProjectProfit || (projectRevenue - projectDirectCosts));
  const projectMarginPercent = numberValue(r.netProjectMarginPercent || pct(projectContribution, projectRevenue));
  const minimumProjectMarginPercent = numberValue(r.minimumMarginPercent || a.minimumMarginPercent);

  return {
    hardware: {
      revenue: hardwareRevenue,
      directCost: hardwareDirectCost,
      margin: hardwareMargin,
      marginPercent: pct(hardwareMargin, hardwareRevenue),
    },
    cms: {
      revenueAnnual: cmsRevenueAnnual,
      costAnnual: cmsCostAnnual,
      marginAnnual: cmsMarginAnnual,
      marginPercent: pct(cmsMarginAnnual, cmsRevenueAnnual),
      customerContractValue: cmsCustomerContractValue,
      supplierContractCost: cmsSupplierContractCost,
      contractMargin: cmsCustomerContractValue - cmsSupplierContractCost,
    },
    gateway: {
      revenueAnnual: gatewayRevenueAnnual,
      costAnnual: gatewayCostAnnual,
      marginAnnual: gatewayMarginAnnual,
      marginPercent: pct(gatewayMarginAnnual, gatewayRevenueAnnual),
    },
    otherOpex: {
      revenueAnnual: otherOpexRevenueAnnual,
      costAnnual: otherOpexCostAnnual,
      marginAnnual: otherOpexMarginAnnual,
      marginPercent: pct(otherOpexMarginAnnual, otherOpexRevenueAnnual),
    },
    recurringOpex: {
      revenueAnnual: recurringRevenueAnnual,
      costAnnual: recurringCostAnnual,
      marginAnnual: recurringMarginAnnual,
      marginPercent: pct(recurringMarginAnnual, recurringRevenueAnnual),
      customerContractValue: recurringCustomerContractValue,
      supplierContractCost: recurringSupplierContractCost,
      contractMargin: recurringCustomerContractValue - recurringSupplierContractCost,
    },
    adaptive: {
      revenueAnnual: adaptiveRevenueAnnual,
      costAnnual: adaptiveCostAnnual,
      marginAnnual: adaptiveMarginAnnual,
      marginPercent: pct(adaptiveMarginAnnual, adaptiveRevenueAnnual),
      customerContractValue: adaptiveCustomerContractValue,
      supplierContractCost: adaptiveSupplierContractCost,
      contractMargin: adaptiveContractMargin,
    },
    project: {
      revenue: projectRevenue,
      directCosts: projectDirectCosts,
      contribution: projectContribution,
      marginPercent: projectMarginPercent,
      minimumMarginPercent: minimumProjectMarginPercent,
      marginBufferPercent: projectMarginPercent - minimumProjectMarginPercent,
    },
  };
}
