import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPanelMenu} from './panelMenu.js';

test('dashboard opens collapsed, updates active cards and keeps disabled providers reachable', () => {
  const seen = {};
  const actions = {setProvider: (...args) => seen.provider = args,
    setComponent: (...args) => seen.component = args};
  const widgets = {createDashboard(_menu, _settings, callbacks) {
    seen.callbacks = callbacks;
    return {cards: results => seen.cards = results.map(p => p.id),
      row: (result, enabled, open) => seen[result.id] = {result, enabled, open},
      destroy: () => seen.destroyed = true};
  }};
  let enabled = ['claude'];
  const results = [{id:'claude', label:'Claude'}, {id:'codex', label:'Codex'}];
  const cleanup = buildPanelMenu({}, results,
    {get_strv: key => key === 'enabled-providers' ? enabled : []}, widgets, actions);
  assert.deepEqual(seen.cards, ['claude']);
  assert.equal(seen.claude.open, false);
  assert.equal(seen.codex.enabled, false);
  seen.callbacks.expand('claude');
  assert.equal(seen.claude.open, true);
  seen.callbacks.setProvider('codex', true);
  assert.deepEqual(seen.provider, ['codex', true]);
  assert.equal(seen.claude.open, true);
  enabled = ['claude', 'codex'];
  cleanup.sync();
  assert.deepEqual(seen.cards, enabled);
  seen.callbacks.expand('codex');
  assert.equal(seen.claude.open, false);
  const updated = {...results[1], sessions: [{name:'Weekly', usedPercent:31}]};
  cleanup.update(updated);
  assert.equal(seen.codex.result, updated);
  assert.equal(seen.codex.open, true);
  enabled = [];
  cleanup.sync();
  assert.deepEqual(seen.cards, []);
  assert.equal(seen.codex.enabled, false);
  cleanup();
  cleanup.update(results[1]);
  assert.equal(seen.codex.result, updated);
  assert.equal(seen.destroyed, true);
});
