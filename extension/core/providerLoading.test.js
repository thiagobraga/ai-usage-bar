import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDERS, ProviderLoading, visibleProviderIds} from './providerLoading.js';
import {ProviderRegistry} from './providerRegistry.js';

test('OpenCode is one provider; its OpenAI quota is not a separate entry', () => {
  assert.deepEqual(PROVIDERS.map(provider => provider.id), ['claude', 'codex', 'antigravity', 'opencode']);
});

test('background selection requires both an enabled provider and a visible component', () => {
  const settings = {get_strv: key => key === 'enabled-providers'
    ? ['claude', 'codex', 'antigravity'] : ['claude:Session', 'codex-other:icon', 'opencode:icon']};
  assert.deepEqual(visibleProviderIds(settings), ['claude']);
});

test('provider ids removed from the extension are ignored in saved settings', () => {
  const settings = {get_strv: key => key === 'enabled-providers'
    ? ['claude', 'opencode-openai', 'opencode'] : ['claude:icon', 'opencode-openai:Session', 'opencode:activity']};
  assert.deepEqual(visibleProviderIds(settings), ['claude', 'opencode']);
  assert.deepEqual(visibleProviderIds(settings, true), ['claude', 'opencode']);
});

test('opening the dashboard includes enabled providers with no panel components', () => {
  const settings = {get_strv: key => key === 'enabled-providers'
    ? ['claude', 'codex'] : ['claude:icon', 'opencode:activity']};
  assert.deepEqual(visibleProviderIds(settings, true), ['claude', 'codex']);
  assert.deepEqual(visibleProviderIds(settings, false), ['claude']);
});

test('loads a provider once and releases menu-only instances on close', async () => {
  const registry = new ProviderRegistry();
  const destroyed = [];
  let loads = 0;
  const loading = new ProviderLoading(registry, async id => {
    loads++;
    return {id, destroy: () => destroyed.push(id)};
  });
  await Promise.all([loading.ensure('claude'), loading.ensure('claude')]);
  assert.equal(loads, 1);
  assert.ok(registry.get('claude'));
  loading.sync([]);
  assert.equal(registry.get('claude'), undefined);
  assert.deepEqual(destroyed, ['claude']);
  await loading.ensure('claude');
  assert.equal(loads, 2);
  loading.destroy();
  assert.deepEqual(destroyed, ['claude', 'claude']);
});

test('a provider finishing import after release never registers', async () => {
  const registry = new ProviderRegistry();
  let complete;
  let destroyed = false;
  const loading = new ProviderLoading(registry, () => new Promise(resolve => { complete = resolve; }));
  const pending = loading.ensure('codex');
  await Promise.resolve();
  loading.release('codex');
  complete({id: 'codex', destroy: () => { destroyed = true; }});
  assert.equal(await pending, null);
  assert.equal(registry.get('codex'), undefined);
  assert.equal(destroyed, true);
});

test('unregistered provider cannot repopulate cache after a pending fetch', async () => {
  const registry = new ProviderRegistry();
  let complete;
  registry.register({id: 'claude', isConfigured: true,
    fetch: () => new Promise(resolve => { complete = resolve; }), destroy: () => {}});
  const pending = registry.refreshOne('claude', null);
  registry.unregister('claude');
  complete({id: 'claude', status: 'ok', sessions: []});
  await pending;
  assert.equal(registry.getCached('claude'), null);
});

test('background refresh targets only the explicit provider ids', async () => {
  const registry = new ProviderRegistry();
  const fetched = [];
  for (const id of ['claude', 'codex']) registry.register({id, isConfigured: true,
    fetch: async () => { fetched.push(id); return {id, status: 'ok'}; }});
  await registry.refreshAll({get_strv: () => ['claude', 'codex']}, ['claude']);
  assert.deepEqual(fetched, ['claude']);
});

console.log('provider loading tests passed');
