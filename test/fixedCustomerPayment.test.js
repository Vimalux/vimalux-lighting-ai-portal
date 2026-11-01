import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultProject } from '../src/model.js';
import { calculateBusinessCase } from '../src/calculations.js';
import fs from 'node:fs';
import { customerAnalysisResult } from '../src/vat.js';
import { buildYearOneCustomerValuePhases } from '../src/customerValuePhases.js';
import { internalProfitabilityMetrics } from '../src/profitabilityMetrics.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
function fixture(dealType, powerAidEnabled, opexEscalation) {
  const p = defaultProject({ applyStoredDefaults: false });
  Object.assign(p.assumptions, { dealType, financingPeriod: 10, financingYears: 10, serviceAgreementPeriod: 10, contractYears: 10, powerAidServicePeriod: 10, analysisPeriod: 10, energyEscalation: 2, opexEscalation });
  Object.assign(p.solution, { smartEnabled: true, cmsEnabled: true, powerAidEnabled });
  return p;
}

for (const deal of ['cash', 'finance', 'noleggio_operativo']) {
  for (const adaptive of [false, true]) {
    for (const rate of [0, 2]) {
      test(`${deal}: fixed customer payments, Adaptive=${adaptive}, internal OPEX=${rate}%`, () => {
        const p = fixture(deal, adaptive, rate);
        const r = calculateBusinessCase(p);
        const first = r.customerCashFlowRows[0];
        for (const row of r.customerCashFlowRows) {
          near(row.customerGrossPayment + row.customerGrossServiceOpex, first.customerGrossPayment + first.customerGrossServiceOpex);
          near(row.powerAidCustomerFee, first.powerAidCustomerFee);
          near(row.customerNetCashFlow, row.customerGrossBenefit - row.customerGrossPayment - row.customerGrossServiceOpex);
        }
        assert.ok(r.customerCashFlowRows[9].customerGrossEnergyBenefit > first.customerGrossEnergyBenefit);
        near(r.powerAidContractRevenue, r.powerAidCustomerFee * 10);
        if (deal !== 'noleggio_operativo') near(r.contractOpexRevenue, r.totalAnnualOpex * 10);
        near(r.customerGrossContractValue, (deal === 'cash' ? r.vatSummary.municipalityCapexCash : 0) + 10 * (first.customerGrossPayment + first.customerGrossServiceOpex));
        const metrics = internalProfitabilityMetrics(p, r);
        near(metrics.cms.customerContractValue, r.cmsRevenue * 10);
        near(metrics.recurringOpex.customerContractValue, r.fixedAnnualOpex * 10);
      });
    }
  }
}

test('internal inflation affects costs and margin, not customer payments or kWh', () => {
  const p = fixture('finance', true, 0);
  const flat = calculateBusinessCase(p);
  p.assumptions.opexEscalation = 5;
  const rising = calculateBusinessCase(p);
  near(rising.customerGrossContractValue, flat.customerGrossContractValue);
  near(rising.finalKwh, flat.finalKwh);
  near(rising.customerCashLifecycleResult, flat.customerCashLifecycleResult);
  assert.ok(rising.contractOpexCost > flat.contractOpexCost);
  assert.ok(rising.netProjectProfit < flat.netProjectProfit);
});

test('payments stop at their respective service and finance terms', () => {
  const p = fixture('finance', true, 2);
  Object.assign(p.assumptions, { financingPeriod: 5, financingYears: 5, powerAidServicePeriod: 7, analysisPeriod: 12 });
  const r = calculateBusinessCase(p);
  assert.ok(r.cashFlowRows[4].payment > 0);
  assert.equal(r.cashFlowRows[5].payment, 0);
  assert.ok(r.cashFlowRows[6].powerAidCustomerFee > 0);
  assert.equal(r.cashFlowRows[7].powerAidCustomerFee, 0);
  assert.ok(r.cashFlowRows[9].serviceOpex > 0);
  assert.equal(r.cashFlowRows[10].serviceOpex, 0);
});


test('Preview chart and cash table use the same VAT-inclusive fixed payments', () => {
  const p = fixture('finance', true, 2);
  const result = calculateBusinessCase(p);
  const view = customerAnalysisResult(result);
  const phase = buildYearOneCustomerValuePhases(view).phases[0].display;
  near(phase.customerSaving, view.cashFlowRows[0].netCashFlow);
  near(phase.servicePayment + phase.investmentPayment, result.customerGrossAnnualPayment);
  near(view.customerValueRows[0].servicePayment / 12 + view.customerValueRows[0].investmentPayment / 12, result.customerGrossMonthlyPayment);
  const runtime = fs.readFileSync(new URL('../src/reportHybridRuntime.js', import.meta.url), 'utf8');
  assert.match(runtime, /repairCustomerValueChart\(report, live.project, customerAnalysisResult\(live.result\)\)/);
});
