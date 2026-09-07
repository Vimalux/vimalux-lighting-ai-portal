const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const positive = (value) => Math.max(0, n(value));

export function customerValuePhaseKey(row = {}) {
  return `${Boolean(row?.cmsActive)}|${Boolean(row?.powerAidActive)}|${positive(row?.investmentPayment) > 0}`;
}

export function buildYearOneCustomerValueScenario(calculated = {}, row = {}) {
  const rows = Array.isArray(calculated?.customerValueRows) ? calculated.customerValueRows : [];
  const first = rows[0] || {};
  const firstCash = Array.isArray(calculated?.cashFlowRows) ? (calculated.cashFlowRows[0] || {}) : {};
  const currentOperatingCost = positive(first?.currentOperatingCost);
  const cmsActive = Boolean(row?.cmsActive);
  const powerAidActive = cmsActive && Boolean(row?.powerAidActive);

  const ledSaving = positive(firstCash?.ledEnergySavingEUR);
  const hybridSolarSaving = positive(firstCash?.hybridSolarSavingEUR || calculated?.hybridSolarSavingEUR);
  const cloSaving = cmsActive ? positive(firstCash?.cloSavingEUR) : 0;
  const maintenanceSaving = cmsActive ? positive(calculated?.maintenanceSaving) : 0;
  const powerAidSaving = powerAidActive ? positive(firstCash?.powerAidGrossSavingEUR) : 0;
  const grossBenefit = ledSaving + hybridSolarSaving + cloSaving + maintenanceSaving + powerAidSaving;

  const fixedServiceOpex = cmsActive ? positive(calculated?.fixedAnnualOpex) : 0;
  const powerAidFee = powerAidActive ? positive(firstCash?.powerAidCustomerFee) : 0;
  const servicePayment = calculated?.dealType === "noleggio_operativo" ? 0 : fixedServiceOpex + powerAidFee;
  const investmentPayment = positive(row?.investmentPayment);
  const futureOperatingCost = Math.max(0, currentOperatingCost - grossBenefit);
  const customerSaving = currentOperatingCost - futureOperatingCost - servicePayment - investmentPayment;

  return {
    currentOperatingCost,
    futureOperatingCost,
    servicePayment,
    investmentPayment,
    customerSaving,
    grossBenefit,
    ledSaving,
    hybridSolarSaving,
    cloSaving,
    maintenanceSaving,
    powerAidSaving,
    cmsActive,
    powerAidActive,
    reconciledTotal: futureOperatingCost + servicePayment + investmentPayment + customerSaving,
  };
}

export function buildYearOneCustomerValuePhases(calculated = {}) {
  const rows = Array.isArray(calculated?.customerValueRows) ? calculated.customerValueRows : [];
  const first = rows[0] || null;
  if (!first) return { phases: [], rows, first: null, analysisPeriod: 0, serviceYears: 0 };

  const phases = [];
  let startIndex = 0;
  for (let index = 1; index <= rows.length; index += 1) {
    if (index === rows.length || customerValuePhaseKey(rows[index]) !== customerValuePhaseKey(rows[startIndex])) {
      const row = rows[startIndex];
      phases.push({
        start: startIndex + 1,
        end: index,
        row,
        display: buildYearOneCustomerValueScenario(calculated, row),
      });
      startIndex = index;
    }
  }

  return {
    phases,
    rows,
    first,
    analysisPeriod: Math.max(1, Math.round(positive(calculated?.analysisPeriod) || rows.length)),
    serviceYears: Math.max(0, Math.round(positive(calculated?.serviceAgreementPeriod))),
  };
}

export function customerValueSegments(display = {}) {
  const current = positive(display?.currentOperatingCost);
  const values = {
    futureOperatingCost: positive(display?.futureOperatingCost),
    servicePayment: positive(display?.servicePayment),
    investmentPayment: positive(display?.investmentPayment),
    customerSaving: Math.max(0, n(display?.customerSaving)),
  };
  return Object.entries(values).map(([key, value]) => ({
    key,
    value,
    pct: current ? value / current * 100 : 0,
  }));
}
