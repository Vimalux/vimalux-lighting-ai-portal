import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const source = await readFile(new URL('./ScenarioOptimizerPanel.jsx', import.meta.url), 'utf8');
const resolved = source.replace('"react"', JSON.stringify(import.meta.resolve('react')))
  .replace('"./scenarioOptimizer.js"', JSON.stringify(new URL('./scenarioOptimizer.js', import.meta.url).href));
const { code } = await transformWithEsbuild(resolved, 'ScenarioOptimizerPanel.jsx', { loader: 'jsx', jsx: 'transform' });
const { ScenarioRateNotice } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const project = { assumptions: { interestRate: 8, discountRate: 6, interestRateSnapshot: { annualRate: 8 } } };

test('agent and unknown role render no rates, labels or controls; admin retains values', () => {
  for (const role of [true, undefined]) {
    const html = renderToStaticMarkup(React.createElement(ScenarioRateNotice, { project, isAgent: role }));
    assert.equal(html, '');
  }
  const admin = renderToStaticMarkup(React.createElement(ScenarioRateNotice, { project, isAgent: false }));
  assert.match(admin, /8%/); assert.match(admin, /6%/);
  assert.match(admin, /tasso finanziamento/); assert.match(admin, /tasso di sconto/);
  assert.doesNotMatch(admin, /<input|<select/);
});

test('unclear basis displays warning for agents without exposing rates', () => {
  const html = renderToStaticMarkup(React.createElement(ScenarioRateNotice, { project: { assumptions: { interestRate: 8 } }, isAgent: true }));
  assert.match(html, /NPV non disponibile/);
  assert.doesNotMatch(html, /8%|tasso finanziamento|tasso di sconto/);
});

test('application role reaches optimizer and its financial notice', async () => {
  const app = await readFile(new URL('./App.jsx', import.meta.url), 'utf8');
  assert.match(app, /<ScenarioOptimizerPanel key=\{p.id\} project=\{p\} isAgent=\{isAgent\}/);
  assert.match(source, /<ScenarioRateNotice project=\{project\} isAgent=\{isAgent\}/);
});
