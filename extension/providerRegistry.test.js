import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProviderRegistry} from './providerRegistry.js';

const settings = {get_strv: () => ['claude', 'codex']};
test('a failed provider does not block the other or invent usage', async () => {
  const registry = new ProviderRegistry();
  registry.register({id: 'claude', isConfigured: true, fetch: async () => { throw Error('offline'); }});
  registry.register({id: 'codex', isConfigured: true, fetch: async () => ({id: 'codex', status: 'ok', sessions: [{name: 'Session', usedPercent: 0}]})});
  await registry.refreshAll(settings);
  assert.equal(registry.getCached('claude').status, 'error');
  assert.deepEqual(registry.getCached('claude').sessions, []);
  assert.equal(registry.getCached('codex').sessions[0].usedPercent, 0);
  registry.destroy();
});

test('disabling cancels providers and late completions do not repopulate cache', async () => {
  const registry = new ProviderRegistry();
  let finish;
  let destroyed = false;
  registry.register({id: 'claude', isConfigured: true,
    fetch: () => new Promise(resolve => { finish = resolve; }),
    destroy: () => { destroyed = true; }});
  const refresh = registry.refreshAll(settings);
  registry.destroy();
  finish({id: 'claude', status: 'ok'});
  await refresh;
  assert.equal(destroyed, true);
  assert.equal(registry.getCached('claude'), null);
});

const claudeOnly = {get_strv: () => ['claude']};
const good = {id: 'claude', status: 'ok', lastUpdated: new Date(), sessions: [{name: 'Session', usedPercent: 12}]};
const failure = errorKind => ({id: 'claude', status: 'error', errorKind, sessions: [], error: errorKind});

test('transient failure keeps last good reading as stale', async () => {
  const registry = new ProviderRegistry();
  const queue = [good, failure('unavailable')];
  registry.register({id: 'claude', isConfigured: true, fetch: async () => queue.shift()});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  const cached = registry.getCached('claude');
  assert.equal(cached.status, 'stale');
  assert.equal(cached.sessions[0].usedPercent, 12);
  assert.equal(cached.errorKind, 'unavailable');
  registry.destroy();
});

test('auth failure replaces last good reading', async () => {
  const registry = new ProviderRegistry();
  const queue = [good, failure('expired')];
  registry.register({id: 'claude', isConfigured: true, fetch: async () => queue.shift()});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  assert.equal(registry.getCached('claude').status, 'error');
  registry.destroy();
});

test('rate limit pauses background refresh; manual refresh bypasses', async () => {
  const registry = new ProviderRegistry();
  let calls = 0;
  const queue = [failure('rate-limited'), good];
  registry.register({id: 'claude', isConfigured: true, fetch: async () => { calls++; return queue.shift(); }});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  assert.equal(calls, 1);
  assert.equal((await registry.refreshOne('claude', claudeOnly)).status, 'ok');
  assert.equal(calls, 2);
  registry.destroy();
});

test('error warning includes the provider error detail', async () => {
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  try {
    const registry = new ProviderRegistry();
    registry.register({id: 'claude', isConfigured: true, fetch: async () => ({id: 'claude', status: 'error',
      errorKind: 'unavailable', error: 'Claude usage: unavailable.', errorDetail: 'HTTP 500 Server Error'})});
    await registry.refreshAll({get_strv: () => ['claude']});
    registry.destroy();
  } finally { console.warn = original; }
  assert.match(warnings[0], /\(HTTP 500 Server Error\)/);
});

test('provider timeoutMs overrides the default registry timeout', async () => {
  const registry = new ProviderRegistry();
  registry.register({id: 'claude', isConfigured: true, timeoutMs: 6500,
    fetch: () => new Promise(resolve => setTimeout(() => resolve({...good}), 5300))});
  await registry.refreshAll(claudeOnly);
  assert.equal(registry.getCached('claude').status, 'ok');
  registry.destroy();
});

test('usageIO maps GJS enum errors for unknown HTTP codes to the status', () => {
  const parse = message => Number(/^(\d+) is not a valid value/.exec(message)?.[1]);
  assert.equal(parse('429 is not a valid value for enumeration Status'), 429);
  assert.ok(Number.isNaN(parse('other failure')));
});

const stale429 = {id: 'claude', status: 'stale', errorKind: 'rate-limited', lastUpdated: new Date(),
  sessions: [{name: 'Session', usedPercent: 5}]};

test('rate limit reported as a stale result still starts backoff', async () => {
  const registry = new ProviderRegistry();
  let calls = 0;
  registry.register({id: 'claude', isConfigured: true, fetch: async () => { calls++; return stale429; }});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  assert.equal(calls, 1);
  registry.destroy();
});

test('a thrown fetch error is not labeled timeout and replaces the last good reading', async () => {
  const registry = new ProviderRegistry();
  const queue = [() => good, () => { throw new TypeError('parser bug'); }];
  registry.register({id: 'claude', isConfigured: true, fetch: async () => queue.shift()()});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  const cached = registry.getCached('claude');
  assert.equal(cached.status, 'error');
  assert.equal(cached.errorKind, 'error');
  assert.match(cached.error, /parser bug/);
  registry.destroy();
});

test('registry timeout is labeled timeout and keeps the last good reading as stale', async () => {
  const registry = new ProviderRegistry();
  let first = true;
  registry.register({id: 'claude', isConfigured: true, timeoutMs: 20,
    fetch: () => { if (first) { first = false; return Promise.resolve(good); } return new Promise(() => {}); }});
  await registry.refreshAll(claudeOnly);
  await registry.refreshAll(claudeOnly);
  const cached = registry.getCached('claude');
  assert.equal(cached.status, 'stale');
  assert.equal(cached.errorKind, 'timeout');
  registry.destroy();
});

test('onResult fires per provider as each finishes, before the slow one', async () => {
  const registry = new ProviderRegistry();
  registry.register({id: 'claude', isConfigured: true,
    fetch: () => new Promise(resolve => setTimeout(() => resolve({...good}), 60))});
  registry.register({id: 'codex', isConfigured: true,
    fetch: async () => ({id: 'codex', status: 'ok', sessions: [{name: 'Session', usedPercent: 1}]})});
  const order = [];
  await registry.refreshAll(settings, null, id => order.push(`${id}:${registry.getCached(id)?.status}`));
  assert.deepEqual(order, ['codex:ok', 'claude:ok']);
  registry.destroy();
});
