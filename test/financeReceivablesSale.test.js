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

test('staging QA cessione del credito reconciles 5% purchase price, 8% customer instalments and retained services',()=>{
  // Financial acceptance case BC-QA-FIN-20261117. The partner buys only the
  // financing receivable; recurring CMS remains payable to VIMALUX.
  const p=defaultProject({applyStoredDefaults:false});
  const lcu=p.catalogue.smart.find((item)=>item.id===p.solution.lcuProductId);
  Object.assign(lcu,{
    costPrice:35,salesPrice:62,implementationCost:0,
    implementationSalesPrice:0,annualCost:3,annualSalesPrice:4,
  });
  p.solution.warrantyYears=10;
  p.solution.powerAidEnabled=false;
  Object.assign(p.assumptions,{
    dealType:'finance',financingModel:'finance',interestRate:8,
    financingPeriod:5,financingYears:5,serviceAgreementPeriod:10,
    contractYears:10,analysisPeriod:10,fundingCostPercent:5,
    financeTransferFee:0,freightCostPerLamp:11,freightSalesPerLamp:12,
    opexEscalation:0,
    agent1CommissionPercent:8,agent2CommissionPercent:15,
    warrantyReservePercent:2,otherDirectCosts:3000,minimumMarginPercent:30,
  });
  p.additionalCosts=[{
    id:'qa-install-100',description:'Installazione e smaltimento (QA)',
    category:'lavoro',costType:'capex',quantity:100,unit:'pz',
    unitCost:30,unitSalesPrice:35,
  }];

  const five=calculateBusinessCase(p,{publish:false});
  const annualCustomerRate=8/12/100;
  const partnerMonthlyRate=5/12/100;
  const instalment=28628.5*annualCustomerRate/(1-Math.pow(1+annualCustomerRate,-60));
  const purchasePrice=instalment*(1-Math.pow(1+partnerMonthlyRate,-60))/partnerMonthlyRate;
  near(five.totalCapex,28628.5);
  near(five.financingMonthlyPayment,instalment);
  near(five.financeReceivablesSale.nominal,instalment*60);
  near(five.financeReceivablesSale.grossProceeds,purchasePrice);
  near(five.financeReceivablesSale.netProceeds,purchasePrice);
  near(five.financeReceivablesDiscount,instalment*60-purchasePrice);
  near(five.contractOpexRevenue,4000);
  near(five.contractOpexCost,3000);
  near(five.vimaluxRevenue,purchasePrice+4000);
  near(five.vimaluxDirectCosts,12500+1100+3000+3000+3824.555+572.57+3000);
  near(five.netProjectProfit,7763.066137269881);
  near(five.netProjectMarginPercent,22.333209005132083);
  assert.equal(five.decisionStatus,'REVIEW');

  // A more expensive partner changes only the sale proceeds and VIMALUX
  // profit: the client's signed payment schedule and CMS revenue stay fixed.
  p.assumptions.fundingCostPercent=6;
  const six=calculateBusinessCase(p,{publish:false});
  near(six.netProjectProfit,7028.67095110665);
  near(five.netProjectProfit-six.netProjectProfit,734.3951861632268);
  near(six.vimaluxDirectCosts,five.vimaluxDirectCosts);
  near(six.financingMonthlyPayment,five.financingMonthlyPayment);
  near(six.contractOpexRevenue,five.contractOpexRevenue);

  // A separate transfer fee must reduce cash proceeds and contribution once,
  // never also lower the gross purchase price.
  p.assumptions.fundingCostPercent=5;
  p.assumptions.financeTransferFee=500;
  const fee=calculateBusinessCase(p,{publish:false});
  near(fee.financeReceivablesSale.grossProceeds,five.financeReceivablesSale.grossProceeds);
  near(fee.vimaluxUpfrontCash,five.vimaluxUpfrontCash-500);
  near(fee.vimaluxRevenue,five.vimaluxRevenue);
  near(fee.vimaluxDirectCosts,five.vimaluxDirectCosts+500);
  near(fee.netProjectProfit,five.netProjectProfit-500);
});
