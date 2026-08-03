import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase, numberValue } from "../src/calculations.js";
import { defaultProject, migrateProject } from "../src/model.js";
import { formatMoney, formatNumber } from "../src/i18n.js";

test("decimal parser accepts European and English formats",()=>{assert.equal(numberValue("0,25"),.25);assert.equal(numberValue("0.25"),.25);assert.equal(numberValue("1.250,50"),1250.5);assert.equal(numberValue("1250.50"),1250.5)});
test("Italian formatting always shows four-digit thousands separators",()=>{assert.match(formatNumber(8184,"it"),/8\.184/);assert.match(formatMoney(4641,"it"),/4\.641/)});
test("LED only gates all smart savings and costs",()=>{const p=defaultProject();p.solution.smartEnabled=false;p.solution.cmsEnabled=false;p.solution.powerAidEnabled=false;const r=calculateBusinessCase(p);assert.equal(r.lcuQuantity,0);assert.equal(r.smartHardwareCapex,0);assert.equal(r.cmsOpex,0);assert.equal(r.cloSavingKwh,0);assert.equal(r.powerAidSavingKwh,0);assert.equal(r.powerAidFee,0)});
test("Smart calculates automatic LCU and CLO without PowerAiD",()=>{const p=defaultProject();p.solution.powerAidEnabled=false;const r=calculateBusinessCase(p);assert.equal(r.lcuQuantity,100);assert.ok(r.cloSavingKwh>0);assert.equal(r.powerAidSavingKwh,0);assert.equal(r.powerAidFee,0)});
test("PowerAiD applies after CLO and fee only to its saving",()=>{const p=defaultProject();p.solution.powerAidEnabled=true;const r=calculateBusinessCase(p);const after=r.ledKwh-r.cloSavingKwh;assert.ok(Math.abs(r.powerAidSavingKwh-after*.4)<1e-9);assert.ok(Math.abs(r.powerAidFee-r.powerAidSavingKwh*p.assumptions.energyPrice*.2)<1e-9)});
test("cash and financed payments differ",()=>{const cash=defaultProject();assert.equal(calculateBusinessCase(cash).monthlyPayment,0);const financed=defaultProject();financed.assumptions.financingModel="laas";assert.ok(calculateBusinessCase(financed).monthlyPayment>0)});
test("financing includes monthly compound interest",()=>{const p=defaultProject();p.assumptions.financingModel="laas";p.assumptions.interestRate=8;p.assumptions.contractYears=10;const r=calculateBusinessCase(p);const rate=.08/12,months=120,expected=r.totalCapex*rate/(1-Math.pow(1+rate,-months));assert.ok(Math.abs(r.monthlyPayment-expected)<1e-9);assert.ok(r.annualPayment>r.totalCapex/10)});
test("annual customer net benefit deducts both OPEX and financing",()=>{const p=defaultProject();p.assumptions.financingModel="laas";const r=calculateBusinessCase(p);assert.ok(r.totalAnnualOpex>0);assert.ok(r.annualPayment>0);assert.equal(r.customerAnnualNetBenefit,r.grossBenefit-r.totalAnnualOpex-r.annualPayment)});
test("old project data safely receives new fields",()=>{const p=migrateProject({project:{name:"Old"},groups:[]});assert.equal(p.project.name,"Old");assert.equal(p.language,"it");assert.ok(p.assumptions.sapFactor)});
