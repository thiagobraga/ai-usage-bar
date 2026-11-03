import test from 'node:test';
import assert from 'node:assert/strict';
import {compactResetTime, providerSummary} from './usageSummary.js';

const now = Date.UTC(2026, 10, 3);
const hours = value => new Date(now + value * 3600000);
const result = {id: 'codex', label: 'Codex', status: 'ok', sessions: [
  {name: 'Weekly', usedPercent: 81, resetsAt: hours(29)},
  {name: 'Session', usedPercent: 0, resetsAt: hours(1.5)},
]};

test('summary maps session and weekly by name, keeping true zero', () => {
  const summary = providerSummary(result, now);
  assert.deepEqual(summary.rings, [0, 81]);
  assert.equal(summary.value, '0%');
  assert.deepEqual(summary.rows.map(row => row.reset), ['Resets in 1h 30m', 'Resets in 1d 5h']);
});

test('expired, missing and error readings are unavailable, stale values identified', () => {
  const summary = providerSummary({...result, status: 'stale', sessions: [result.sessions[1]]}, hours(2));
  assert.deepEqual(summary.rings, [null, null]);
  assert.match(summary.rows[0].reset, /awaiting/i);
  assert.match(summary.status, /stale/i);
  assert.deepEqual(providerSummary({...result, status: 'error'}, now).rings, [null, null]);
});

test('OpenCode local activity shows real tokens and cost without inferring limits', () => {
  const data = {id: 'opencode', label: 'OpenCode', status: 'ok', totalTokens: 1200,
    activity: [{provider: 'openai', tokens: 1200, cost: 0.75}]};
  const summary = providerSummary(data, now);
  assert.deepEqual(summary.rings, []);
  assert.equal(summary.value, '1.2K');
  assert.equal(summary.rows[0].value, '1.2K tokens');
  assert.equal(summary.rows[0].reset, '$0.75');
  assert.equal(providerSummary({...data, status: 'error'}, now).value, '–');
});

test('OpenCode adds its OpenAI quota as a second section without changing the token value', () => {
  const data = {id: 'opencode', label: 'OpenCode', status: 'ok', totalTokens: 1200, plan: 'plus',
    activity: [{provider: 'openai', tokens: 1200, cost: 0.75}],
    sessions: [{name: 'Session', usedPercent: 22, resetsAt: now + 3 * 3600000},
      {name: 'Weekly', usedPercent: 38, resetsAt: now + 2 * 86400000}]};
  const summary = providerSummary(data, now);
  assert.equal(summary.value, '1.2K');
  assert.deepEqual(summary.rings, []);
  assert.equal(summary.quota.heading, 'OpenAI quota');
  assert.deepEqual(summary.quota.rows.map(row => [row.label, row.value, row.percent]),
    [['5-hour limit', '22% used', 22], ['Weekly limit', '38% used', 38]]);
  assert.equal(summary.quota.rows[0].reset, 'Resets in 3h');
  assert.equal(providerSummary({...data, sessions: [], quotaError: 'expired'}, now).quota.empty, 'Quota unavailable');
  assert.equal(providerSummary({...data, sessions: []}, now).quota, undefined);
});

test('relative time rounds up to the next minute and rejects missing timestamps', () => {
  assert.equal(compactResetTime(now + 5000, now), '1m');
  assert.equal(compactResetTime(null, now), null);
  assert.equal(compactResetTime('invalid', now), null);
  assert.equal(compactResetTime(now, now), null);
});
