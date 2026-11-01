import test from 'node:test';
import assert from 'node:assert/strict';
import { valueFinanceReceivables } from '../src/financeReceivables.js';
import { defaultProject, migrateProject } from '../src/model.js';
import { calculateBusinessCase } from '../src/calculations.js';
import { internalProfitabilityMetrics } from '../src/profitabilityMetrics.js';
import { buildCrmInternalFinancials } from '../src/crmInternalFinancials.js';

const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);
function project() {
  const p=defaultProject({applyStoredDefaults:false});
  Object.assign(p.assumptions,{dealType:'finance',officialOfferCapex:100000,interestRate:8,fundingCostPercent:7,financingPeriod:10,financingYears:10,serviceAgreementPeriod:10,contractYears:10,analysisPeriod:10,financeTransferFee:0});
  p.solution.powerAidEnabled=true;
  return p;
}
test('known monthly present value, zero rate and explicit fee',()=>{
  const sale=valueFinanceReceivables({monthlyPayment:1000,months:120,annualRatePercent:7,fee:500});
  near(sale.grossProceeds,1000*(1-Math.pow(1+.07/12,-120))/(.07/12));
  near(sale.nominal,120000);near(sale.netProceeds,sale.grossProceeds-500);
  const zero=valueFinanceReceivables({monthlyPayment:1000,months:120,annualRatePercent:0});
  assert.equal(zero.grossProceeds,120000);assert.equal(zero.discount,0);
});
test('8% customer and 7% partner produces proceeds above principal and excludes services',()=>{
  const p=project(),r=calculateBusinessCase(p),sale=r.financeReceivablesSale;
  assert.ok(sale.grossProceeds>100000);
  near(sale.nominal,r.financingMonthlyPayment*120);
  near(sale.grossProceeds,r.financingMonthlyPayment*(1-Math.pow(1+.07/12,-120))/(.07/12));
  const before=sale.grossProceeds;
  p.assumptions.officialAnnualOpex=20000;
  near(calculateBusinessCase(p).financeReceivablesSale.grossProceeds,before);
});
test('same partner and customer rate returns the financed principal',()=>{
  const p=project();p.assumptions.fundingCostPercent=8;p.assumptions.upfrontPayment=20000;
  const r=calculateBusinessCase(p);
  near(r.financeReceivablesSale.grossProceeds,80000);
  near(r.vimaluxUpfrontCash,100000);
});
test('partner rate and fee change internal profit only; customer cashflow is unchanged',()=>{
  const p=project(),base=calculateBusinessCase(p);
  p.assumptions.fundingCostPercent=9;p.assumptions.financeTransferFee=500;
  const changed=calculateBusinessCase(p);
  assert.deepEqual(changed.customerCashFlowRows,base.customerCashFlowRows);
  assert.equal(changed.customerGrossContractValue,base.customerGrossContractValue);
  assert.equal(changed.finalKwh,base.finalKwh);
  assert.ok(changed.vimaluxUpfrontCash<base.vimaluxUpfrontCash);
  assert.ok(changed.netProjectProfit<base.netProjectProfit);
});
test('transfer discount and fee reconcile once to profit, margin and CRM cost bridge',()=>{
  const p=project();p.assumptions.financeTransferFee=500;
  const r=calculateBusinessCase(p),sale=r.financeReceivablesSale;
  near(r.vimaluxRevenue,sale.grossProceeds+r.contractOpexRevenue);
  near(r.vimaluxDirectCosts,r.capexDirectCost+r.dutyCost+r.contractOpexCost+r.commissionCost+r.warrantyReserve+500+p.assumptions.otherDirectCosts);
  near(r.netProjectProfit,r.vimaluxRevenue-r.vimaluxDirectCosts);
  near(r.netProjectProfit,r.totalContractRevenue-r.totalDirectCosts);
  near(r.netProjectMarginPercent,r.netProjectProfit/r.vimaluxRevenue*100);
  near(r.financingCost,sale.discount+500);
  const metrics=internalProfitabilityMetrics(p,r);
  near(metrics.project.revenue,r.vimaluxRevenue);near(metrics.project.directCosts,r.vimaluxDirectCosts);
  const crm=buildCrmInternalFinancials(p,r);
  near(crm.finance_costs,sale.discount+500);
  near(crm.total_direct_costs,r.totalDirectCosts);
});
test('fee reduces upfront proceeds and profit by exactly its amount',()=>{
  const p=project(),base=calculateBusinessCase(p);p.assumptions.financeTransferFee=750;
  const r=calculateBusinessCase(p);
  near(base.netProjectProfit-r.netProjectProfit,750);
  near(base.vimaluxUpfrontCash-r.vimaluxUpfrontCash,750);
});
test('assignment stops at financing term even when service term is longer',()=>{
  const p=project();p.assumptions.financingPeriod=5;p.assumptions.financingYears=5;
  const r=calculateBusinessCase(p);
  near(r.financeReceivablesSale.nominal,r.financingMonthlyPayment*60);
  assert.equal(r.cashFlowRows[5].payment,0);assert.ok(r.cashFlowRows[5].serviceOpex>0);
});
test('cash and all-inclusive models keep their existing commercial economics',()=>{
  for(const dealType of ['cash','noleggio_operativo']){
    const p=project();p.assumptions.dealType=dealType;
    const r=calculateBusinessCase(p);
    assert.equal(r.financeReceivablesSale,null);
    near(r.vimaluxRevenue,r.totalContractRevenue);near(r.vimaluxDirectCosts,r.totalDirectCosts);
  }
});
test('migration preserves saved rates and defaults transfer fees to zero',()=>{
  const p=migrateProject({assumptions:{fundingCostPercent:7,interestRate:8},groups:[]});
  assert.equal(p.assumptions.fundingCostPercent,7);assert.equal(p.assumptions.financeTransferFee,0);
});
