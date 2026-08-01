import test from "node:test";
import assert from "node:assert/strict";
import { calculateBusinessCase, numberValue } from "../src/calculations.js";
import { defaultProject, migrateProject } from "../src/model.js";

test("decimal parser accepts European and English formats",()=>{assert.equal(numberValue("0,25"),.25);assert.equal(numberValue("0.25"),.25);assert.equal(numberValue("1.250,50"),1250.5);assert.equal(numberValue("1250.50"),1250.5)});
test("LED only gates all smart savings and costs",()=>{const p=defaultProject();p.solution.smartEnabled=false;p.solution.cmsEnabled=false;p.solution.powerAidEnabled=false;const r=calculateBusinessCase(p);assert.equal(r.lcuQuantity,0);assert.equal(r.smartHardwareCapex,0);assert.equal(r.cmsOpex,0);assert.equal(r.cloSavingKwh,0);assert.equal(r.powerAidSavingKwh,0);assert.equal(r.powerAidFee,0)});
test("Smart calculates automatic LCU and CLO without PowerAiD",()=>{const p=defaultProject();p.solution.powerAidEnabled=false;const r=calculateBusinessCase(p);assert.equal(r.lcuQuantity,100);assert.ok(r.cloSavingKwh>0);assert.equal(r.powerAidSavingKwh,0);assert.equal(r.powerAidFee,0)});
test("PowerAiD applies after CLO and fee only to its saving",()=>{const p=defaultProject();p.solution.powerAidEnabled=true;const r=calculateBusinessCase(p);const after=r.ledKwh-r.cloSavingKwh;assert.ok(Math.abs(r.powerAidSavingKwh-after*.4)<1e-9);assert.ok(Math.abs(r.powerAidFee-r.powerAidSavingKwh*p.assumptions.energyPrice*.2)<1e-9)});
test("cash and financed payments differ",()=>{const cash=defaultProject();assert.equal(calculateBusinessCase(cash).monthlyPayment,0);const financed=defaultProject();financed.assumptions.financingModel="laas";assert.ok(calculateBusinessCase(financed).monthlyPayment>0)});
test("old project data safely receives new fields",()=>{const p=migrateProject({project:{name:"Old"},groups:[]});assert.equal(p.project.name,"Old");assert.equal(p.language,"it");assert.ok(p.assumptions.sapFactor)});
