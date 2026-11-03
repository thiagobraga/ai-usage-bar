import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {STALE_AFTER_MS, parseClaudeUsage, parseCodexUsage, parseCodexEvent, parseCodexJsonl, parseAntigravityQuota, credentialState} from './usageData.js';

const now = new Date('2026-10-08T02:00:00Z');
const event = () => ({timestamp: now.toISOString(), type: 'event_msg', payload: {
  type: 'token_count', rate_limits: {limit_id: 'codex',
    primary: {used_percent: 18, window_minutes: 300, resets_at: 1791431240},
    secondary: {used_percent: 3, window_minutes: 10080, resets_at: 1792018040}, plan_type: 'plus'},
}});

test('Claude real OAuth schema preserves zero and fractional usage; cost is not inferred', () => {
  const result = parseClaudeUsage({five_hour: {utilization: 0, resets_at: '2026-10-08T05:00:00Z'},
    seven_day: {utilization: 3.5, resets_at: null}, seven_day_sonnet: {utilization: 45}});
  assert.deepEqual(result.map(s => [s.name, s.usedPercent]), [['Session', 0], ['Weekly', 3.5]]);
  assert.equal(result[0].resetsAt.toISOString(), '2026-10-08T05:00:00.000Z');
  assert.equal(result[1].resetsAt, undefined);
});

test('Missing, malformed and out-of-range usage never becomes zero', () => {
  for (const data of [null, undefined, {}, [], {five_hour: {}}, {five_hour: {utilization: null}},
    {five_hour: {utilization: '0'}}, {five_hour: {utilization: -1}}, {five_hour: {utilization: 101}},
    {five_hour: {utilization: NaN}}, {five_hour: {utilization: Infinity}}]) assert.deepEqual(parseClaudeUsage(data), []);
  for (const data of [null, {}, {rate_limit: {}}, {rate_limit: {primary_window: {limit_window_seconds: 18000}}}])
    assert.deepEqual(parseCodexUsage(data), []);
});

test('Codex API schema classifies windows by duration, including reversed ordering', () => {
  const result = parseCodexUsage({rate_limit: {
    primary_window: {used_percent: 3, limit_window_seconds: 604800, reset_at: 1792018040},
    secondary_window: {used_percent: 0, limit_window_seconds: 18000, reset_at: 1791431240}}});
  assert.deepEqual(result.map(s => [s.name, s.usedPercent]), [['Session', 0], ['Weekly', 3]]);
  assert.equal(result[0].resetsAt.getTime(), 1791431240000);
});

test('Unknown durations are omitted and malformed reset is not epoch zero', () => {
  assert.deepEqual(parseCodexUsage({rate_limit: {primary_window: {used_percent: 2}}}), []);
  assert.deepEqual(parseCodexUsage({rate_limit: {primary_window: {used_percent: 2, limit_window_seconds: 60}}}), []);
  const [result] = parseClaudeUsage({five_hour: {utilization: 2, resets_at: 'invalid'}});
  assert.equal(result.resetsAt, undefined);
});

test('Actual local token_count shape has true timestamp, source and no invented cost', () => {
  const result = parseCodexEvent(event(), now);
  assert.equal(result.sessions[0].usedPercent, 18);
  assert.equal(result.sessions[1].usedPercent, 3);
  assert.equal(result.lastUpdated.getTime(), now.getTime());
  assert.match(result.source, /local/);
  assert.equal(result.cost, null);
  assert.equal(result.plan, 'plus');
});

test('Stale age, expired reset, invalid and future observation timestamps', () => {
  const sample = event();
  sample.payload.rate_limits.primary.resets_at = now.getTime() / 1000 + 3600;
  assert.equal(parseCodexEvent(sample, now).status, 'ok');
  assert.equal(STALE_AFTER_MS, 300000);
  assert.equal(parseCodexEvent(sample, new Date(+now + STALE_AFTER_MS)).status, 'ok');
  assert.equal(parseCodexEvent(sample, new Date(+now + STALE_AFTER_MS + 1)).status, 'stale');
  sample.payload.rate_limits.primary.resets_at = now.getTime() / 1000 - 1;
  assert.equal(parseCodexEvent(sample, now).status, 'stale');
  sample.timestamp = 'invalid';
  assert.equal(parseCodexEvent(sample, now), null);
  sample.timestamp = new Date(+now + 1).toISOString();
  assert.equal(parseCodexEvent(sample, now), null);
});

test('JSONL ignores malformed/unrelated records and selects latest observation by timestamp', () => {
  const older = event(); older.timestamp = new Date(+now - 60000).toISOString();
  const latest = event(); latest.payload.rate_limits.primary.used_percent = 0;
  const input = ['{truncated', JSON.stringify(latest), JSON.stringify(older), '{"type":"other"}', ''].join('\n');
  assert.equal(parseCodexJsonl(input, now).sessions[0].usedPercent, 0);
  assert.equal(parseCodexJsonl('', now), null);
  const unrelated = event(); unrelated.payload.rate_limits.limit_id = 'other';
  assert.equal(parseCodexEvent(unrelated, now), null);
  assert.equal(parseCodexEvent({type: 'event_msg', payload: {type: 'token_count'}}, now), null);
});

test('Antigravity summary shows the most-used bucket per window and keeps every bucket', () => {
  const data = JSON.parse(readFileSync(new URL('../fixtures/antigravity-quota-summary.json', import.meta.url), 'utf8'));
  const result = parseAntigravityQuota(data);
  assert.deepEqual(result.map(s => [s.name, s.usedPercent]), [
    ['Session', 49.9], ['Weekly', 85.3], ['Gemini · 5h', 1.8], ['Gemini · weekly', 2],
    ['Claude and GPT · 5h', 49.9], ['Claude and GPT · weekly', 85.3]]);
  assert.equal(result[1].resetsAt.toISOString(), '2026-10-11T04:22:54.000Z');
  assert.match(result[1].resetLabel, /^Claude and GPT: Resets /);
  assert.ok(result.every(s => !('kind' in s) && !('group' in s)));
});

test('Antigravity omitted remainingFraction is exhausted only when the bucket has a reset time', () => {
  const groups = buckets => ({groups: [{displayName: 'Gemini Models', buckets}]});
  assert.equal(parseAntigravityQuota(groups([{window: '5h', resetTime: '2026-10-09T06:13:08Z'}]))[0].usedPercent, 100);
  assert.deepEqual(parseAntigravityQuota(groups([{window: '5h'}])), []);
});

test('Antigravity malformed data never becomes zero usage', () => {
  for (const data of [null, {}, {groups: {}}, {groups: [null]}, {groups: [{buckets: [null]}]},
    {groups: [{buckets: [{window: 'daily', remainingFraction: 1}]}]},
    {groups: [{buckets: [{window: '5h', remainingFraction: '1'}]}]},
    {groups: [{buckets: [{window: '5h', remainingFraction: 1.5}]}]},
    {groups: [{buckets: [{window: '5h', remainingFraction: NaN}]}]}])
    assert.deepEqual(parseAntigravityQuota(data), []);
  const [session] = parseAntigravityQuota({groups: [{buckets: [{window: '5h', remainingFraction: 1}]}]});
  assert.equal(session.usedPercent, 0);
  assert.equal(session.resetLabel, 'Models: Reset time unavailable');
});

test('Missing and expired credentials differ from valid credentials', () => {
  assert.equal(credentialState(null), 'missing');
  assert.equal(credentialState(' '), 'missing');
  assert.equal(credentialState('test', +now - 1, +now), 'expired');
  assert.equal(credentialState('test', +now + 1, +now), 'ready');
  assert.equal(credentialState('test', undefined, +now), 'ready');
});

test('GJS: fallback is always stale and retains budget after live timeout', t => {
  if (spawnSync('gjs', ['--version']).error?.code === 'ENOENT') {
    t.skip('GJS is not installed');
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), 'usage-fallback-test-'));
  const script = join(directory, 'check.mjs');
  const codexUrl = new URL('../codex/codex.js', import.meta.url).href;
  const ioUrl = new URL('./usageIO.js', import.meta.url).href;
  try {
    writeFileSync(script, `
import GLib from 'gi://GLib';
import Codex from ${JSON.stringify(codexUrl)};
import {UsageError} from ${JSON.stringify(ioUrl)};
const root = GLib.getenv('CODEX_HOME');
GLib.mkdir_with_parents(root + '/sessions', 448);
const timestamp = new Date().toISOString();
GLib.file_set_contents(root + '/sessions/test.jsonl', JSON.stringify({timestamp, type: 'event_msg', payload: {
  type: 'token_count', rate_limits: {limit_id: 'codex', primary: {used_percent: 0, window_minutes: 300,
    resets_at: Math.floor(Date.now() / 1000) + 3600}}}}) + '\\n');
for (const failure of ['auth-error', 'timeout']) {
  const provider = new Codex();
  const run = provider._io.run.bind(provider._io);
  let calls = 0;
  const start = GLib.get_monotonic_time();
  provider._io.run = (callback, deadline) => {
    if (++calls === 1) return run(cancellable => {
      if (failure === 'auth-error') throw new UsageError(failure);
      return new Promise((_resolve, reject) => cancellable.connect(() => reject(new Error('cancelled'))));
    }, deadline);
    return run(callback, deadline);
  };
  const result = await provider.fetch(null);
  const elapsedMs = (GLib.get_monotonic_time() - start) / 1000;
  if (result.status !== 'stale' || result.errorKind !== failure || result.sessions[0]?.usedPercent !== 0 ||
      result.lastUpdated?.toISOString() !== timestamp || !(result.sessions[0]?.resetsAt instanceof Date) ||
      calls !== 2 || elapsedMs >= 4500 || (failure === 'timeout' && elapsedMs < 2900))
    throw new Error('Fallback status, timestamp, reset, or deadline regression: ' + failure);
  provider.destroy();
}
`);
    const result = spawnSync('gjs', ['-m', script], {
      env: {...process.env, CODEX_HOME: directory, GSETTINGS_BACKEND: 'memory'},
      encoding: 'utf8', timeout: 8000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
