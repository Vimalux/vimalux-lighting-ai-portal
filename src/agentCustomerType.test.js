import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { projectWithCustomerVatType } from './customerVatProfile.js';
import { defaultProject } from './model.js';
import { calculateBusinessCase } from './calculations.js';

const source = await readFile(new URL('./AgentCustomerType.jsx', import.meta.url), 'utf8');
const resolved = source.replace('"react"', JSON.stringify(import.meta.resolve('react')))
 .replace('"./customerVatProfile.js"', JSON.stringify(new URL('./customerVatProfile.js', import.meta.url).href));
const { code } = await transformWithEsbuild(resolved, 'AgentCustomerType.jsx', { loader: 'jsx', jsx: 'transform' });
const { default: Selector } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('agent can select customer type with a single update and no financial input', () => {
 const project = defaultProject({applyStoredDefaults:false});
 const calls=[];
 const element=Selector({project, update:(...args)=>calls.push(args)});
 const select=element.props.children[1];
 select.props.onChange({target:{value:'esco_company'}});
 assert.deepEqual(calls, [[['customer','customerType'],'esco_company']]);
 const html=renderToStaticMarkup(React.createElement(Selector,{project,update:()=>{},disabled:true}));
 assert.match(html,/disabled/); assert.match(html,/Comune/); assert.match(html,/ESCO/);
 assert.doesNotMatch(html,/interestRate|discountRate|<input/);
});

test('customer type changes VAT cashflow atomically while preserving rates and source', () => {
 const p=defaultProject({applyStoredDefaults:false});
 Object.assign(p.assumptions,{dealType:'finance',financingModel:'finance',interestRate:8,discountRate:6});
 const before=structuredClone(p);
 const municipality=projectWithCustomerVatType(p,'municipality');
 const esco=projectWithCustomerVatType(municipality,'esco_company');
 assert.equal(municipality.assumptions.vatRecoverability,'non_deductible');
 assert.equal(esco.assumptions.vatRecoverability,'deductible');
 assert.equal(esco.assumptions.vatRecoverablePercent,100);
 assert.equal(esco.assumptions.interestRate,8); assert.equal(esco.assumptions.discountRate,6);
 assert.deepEqual(esco.pricing,p.pricing); assert.deepEqual(p,before);
 const a=calculateBusinessCase(municipality,{publish:false});
 const b=calculateBusinessCase(esco,{publish:false});
 assert.equal(a.financingAnnualPayment,b.financingAnnualPayment);
 assert.ok(a.customerCashAnnualNetBenefit < b.customerCashAnnualNetBenefit);
 const other=projectWithCustomerVatType(esco,'other');
 assert.equal(other.assumptions,esco.assumptions);
});

test('agent path has selector and retains rate guards and read-only guard', async()=>{
 const app=await readFile(new URL('./App.jsx',import.meta.url),'utf8');
 const agent=app.slice(app.indexOf('function AgentAssumptions('),app.indexOf('function Customer('));
 assert.match(agent,/<AgentCustomerType/);
 assert.match(agent,/disabled=\{p.crm\?\.agentAccessMode === "read_only"\}/);
 assert.match(app,/if \(currentReadOnly\) return all/);
 assert.match(app,/next = projectWithCustomerVatType\(next, normalized\)/);
 const guard=app.split('\n').find(line=>line.includes('isAgent && path[0] === "assumptions"'));
 assert.ok(guard); assert.doesNotMatch(guard,/interestRate|discountRate|vatRecoverability|vatHardwareRate/);
});
