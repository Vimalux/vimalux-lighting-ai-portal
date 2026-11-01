import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { proposalSolutionScope } from '../src/proposalSolutionScope.js';
import { defaultProject } from '../src/model.js';
import { calculateBusinessCase } from '../src/calculations.js';

test('live calculated quantities replace missing or stale summary counts',()=>{
  const scope=proposalSolutionScope({upgradedQuantity:128,smartQuantity:128,powerAidEnabled:false},{upgradeLuminaires:0,smartConnectedLuminaires:0});
  assert.equal(scope.led,'128 punti luce');assert.equal(scope.connected,'128 punti luce Smart');
  assert.match(scope.adaptive,/Non incluso/);assert.doesNotMatch(scope.adaptive,/Predisposizione/);
});
test('authoritative zero is not replaced by stale nonzero counts',()=>{
  const scope=proposalSolutionScope({upgradedQuantity:0,smartQuantity:0},{upgradeLuminaires:128,smartConnectedLuminaires:128});
  assert.equal(scope.led,'0 punti luce');assert.equal(scope.connected,'0 punti luce Smart');
});
test('existing nightly profile is explicitly accounted for in baseline once',()=>{
  const p=defaultProject({applyStoredDefaults:false});
  p.groups=[{...p.groups[0],quantity:128,existingDimmingProfile:'fixed',existingDimmingMethod:'profile',existingFullPowerHours:6.5,existingReducedHours:5,existingReducedLoadPercent:70}];
  const r=calculateBusinessCase(p),scope=proposalSolutionScope(r);
  assert.equal(scope.led,'128 punti luce');assert.equal(scope.connected,'128 punti luce Smart');
  assert.match(scope.existingDimmingRows[0][1],/già incluso nel consumo di riferimento/);
  assert.match(scope.existingDimmingRows[0][1],/13,04%/);
  assert.match(scope.existingDimmingRows[0][1],/da confermare/);
  assert.ok(Math.abs(r.nominalSystemKwh-r.existingDimmingSavingKwh-r.baselineKwh)<1e-6);
});
test('no dimming claim without a calculated baseline reduction; enabled Adaptive is explicit',()=>{
  const scope=proposalSolutionScope({powerAidEnabled:true}, {}, 'en');
  assert.deepEqual(scope.existingDimmingRows,[]);assert.equal(scope.adaptive,'Adaptive Dimming');
});
test('PDF scope rows are wired to the calculated source and exclude stale zero expressions',()=>{
  const source=fs.readFileSync(new URL('../src/preliminaryProposalV2.js',import.meta.url),'utf8');
  assert.match(source,/proposalSolutionScope\(calculated, result, lang\)/);
  assert.match(source,/scope\.existingDimmingRows/);
  assert.doesNotMatch(source,/Number\(result\.upgradeLuminaires\) \|\| 0/);
  assert.doesNotMatch(source,/Predisposizione \/ da validare/);
});
