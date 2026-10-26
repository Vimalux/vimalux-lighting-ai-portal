import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stagingAuthMode } from './stagingAuthMode.js';

test('authenticated staging is opt-in and never enables preview mode on production', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  assert.equal(Boolean(stagingAuthMode('preview.vercel.app', '', storage)), false);
  assert.equal(stagingAuthMode('preview.vercel.app', '?staging_auth=1', storage), true);
  assert.equal(stagingAuthMode('preview.vercel.app', '', storage), true);
  assert.equal(stagingAuthMode('app.vimalux.com', '?staging_auth=1', storage), false);
  assert.equal(Boolean(stagingAuthMode('preview.vercel.app', '?staging_auth=0', storage)), false);
  const source = fs.readFileSync(new URL('./supabase.js', import.meta.url), 'utf8');
  assert.match(source, /const url = productionHost \? productionUrl : stagingUrl/);
});

function harness(failModuleOnce = false) {
  const rows = [], markers = new Map();
  let callback, titleChanged, authLock = false;
  const storage = { getItem: k => markers.get(k), setItem: (k,v) => markers.set(k,v), removeItem: k => markers.delete(k) };
  const document = { title: 'VIMALUX Intelligence', querySelector: () => ({}) };
  const supabase = { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: cb => { callback = cb; }, signOut: async () => ({}) },
    from() {
      assert.equal(authLock, false, 'audit request ran inside auth callback');
      return { insert: async row => {
        if (row.action === 'module_opened' && failModuleOnce) { failModuleOnce = false; return { error: { message: 'temporary failure' } }; }
        rows.push(row); return {};
      } };
    } };
  const source = fs.readFileSync(new URL('./platformActivityRuntime.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '').replaceAll('export function', 'function');
  vm.runInNewContext(source, { supabase, supabaseConfigured: true, document, window: { location: { pathname: '/', search: '' } }, localStorage: storage, sessionStorage: storage,
    MutationObserver: class { constructor(cb) { titleChanged = cb; } observe() {} }, setTimeout, console: { warn() {} } });
  return { rows, document, titleChanged: () => titleChanged(), event(event, session) { authLock = true; callback(event, session); authLock = false; } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 15));
const session = { user: { id: 'agent-a', last_sign_in_at: '2026-10-26T09:00:00Z' } };

test('platform audit defers auth I/O and deduplicates repeated sign-in notifications', async () => {
  const h = harness(); await settle();
  h.event('SIGNED_IN', session); await settle();
  h.event('SIGNED_IN', session); await settle();
  assert.equal(h.rows.filter(r => r.action === 'login').length, 1);
  assert.equal(h.rows.filter(r => r.action === 'module_opened').length, 1);
  h.document.title = 'VIMALUX CRM'; h.titleChanged(); await settle();
  assert.deepEqual(h.rows.filter(r => r.action === 'module_opened').map(r => r.details.module), ['intelligence', 'crm']);
});

test('failed module write remains retryable and is never marked as recorded', async () => {
  const h = harness(true); await settle();
  h.event('SIGNED_IN', session); await settle();
  assert.equal(h.rows.filter(r => r.action === 'module_opened').length, 0);
  h.titleChanged(); await settle();
  assert.equal(h.rows.filter(r => r.action === 'module_opened').length, 1);
});
