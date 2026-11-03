import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {meterValue, meterSeverity, meterColor, unicodeSegments, meterOrientation, usageSummary, compactTokens} from './meterModel.js';
import {componentChoices, visibleComponents, panelDescription} from './panelComponents.js';

const result = (percent, status = 'ok') => ({label: 'Claude', status,
  sessions: [{name: 'Session', usedPercent: percent}, {name: 'Weekly', usedPercent: 60}]});

test('missing, invalid and failed usage never looks like zero', () => {
  for (const value of [undefined, null, NaN, Infinity, '12'])
    assert.equal(meterValue(result(value), 'Session'), null);
  for (const status of ['error', 'unconfigured'])
    assert.equal(meterValue(result(30, status), 'Session'), null);
  assert.equal(meterValue(result(30), 'Unknown'), null);
  assert.equal(meterValue(null, 'Session'), null);
  assert.equal(unicodeSegments(null), '·····');
});

test('unavailable quota renders a visible dash rather than a zero-length track', () => {
  const source = readFileSync(new URL('./meterWidgets.js', import.meta.url), 'utf8');
  assert.match(source, /if \(value === null\) \{\s*box\.add_child\(new St\.Label\(\{text: '-'/);
});

test('zero and full quotas remain distinct from unavailable and are bounded', () => {
  assert.equal(meterValue(result(0), 'Session'), 0);
  assert.equal(meterValue(result(150), 'Session'), 100);
  assert.equal(meterValue(result(-5), 'Session'), 0);
  assert.equal(unicodeSegments(0), '·····');
  assert.equal(unicodeSegments(100), '■■■■■');
  assert.equal(unicodeSegments(40), '■■···');
});

test('expired window becomes unavailable until another observation arrives', () => {
  const data = result(42);
  data.sessions[0].resetsAt = '2026-10-08T03:00:00Z';
  assert.equal(meterValue(data, 'Session', Date.parse('2026-10-08T02:00:00Z')), 42);
  assert.equal(meterValue(data, 'Session', Date.parse('2026-10-08T03:00:00Z')), null);
});

test('horizontal is default, including previously saved auto; vertical remains explicit', () => {
  assert.equal(meterOrientation('auto'), 'horizontal');
  assert.equal(meterOrientation('horizontal'), 'horizontal');
  assert.equal(meterOrientation('vertical'), 'vertical');
});

test('accessible summaries distinguish windows and flag stale observations', () => {
  assert.equal(usageSummary(result(20)), 'Claude - Session: 20% used, Weekly: 60% used');
  assert.match(usageSummary(result(20, 'stale')), /\(stale\)$/);
  assert.match(usageSummary(result(null)), /Session: unavailable/);
});

test('OpenCode activity summary reports tokens without claiming a quota', () => {
  const data = {id: 'opencode', label: 'OpenCode', status: 'ok', activity: [{provider: 'openai', tokens: 1200}], totalTokens: 1200};
  assert.equal(usageSummary(data), 'OpenCode - 1,200 tokens in 7 days across 1 provider');
});

test('OpenCode panel token totals fit a compact label', () => {
  assert.equal(compactTokens(0), '0');
  assert.equal(compactTokens(1200), '1.2K');
  assert.equal(compactTokens(26833105), '26.8M');
  assert.equal(compactTokens(NaN), '-');
  assert.equal(compactTokens(999999), '1M');
  assert.equal(compactTokens(999949), '999.9K');
});

test('severity: low use is green, high use is red, unavailable is unknown', () => {
  assert.equal(meterSeverity(0), 'low');
  assert.equal(meterSeverity(16), 'low');
  assert.equal(meterSeverity(59), 'low');
  assert.equal(meterSeverity(60), 'medium');
  assert.equal(meterSeverity(84), 'medium');
  assert.equal(meterSeverity(85), 'high');
  assert.equal(meterSeverity(100), 'high');
  assert.equal(meterSeverity(null), 'unknown');
});

test('colour: green to 50, yellow 60, orange 80, near-red 90, pure red 100', () => {
  assert.equal(meterColor(null), null);
  assert.equal(meterColor(0), '#19d39b');
  assert.equal(meterColor(50), '#19d39b');
  assert.equal(meterColor(60), '#f5d90a');
  assert.equal(meterColor(80), '#ff8c00');
  assert.equal(meterColor(85), '#ff5f00');
  assert.equal(meterColor(90), '#ff2a00');
  assert.equal(meterColor(95), '#ff1100');
  assert.equal(meterColor(100), '#ff0000');
  // 55 is halfway green->yellow, 70 halfway yellow->orange
  assert.equal(meterColor(55), '#87d653');
  assert.equal(meterColor(70), '#fab305');
});

test('each quota window has its own persistent visibility and orientation', () => {
  const data = {...result(20), id: 'claude'};
  const selected = visibleComponents(data, ['claude:Session'],
    ['claude:Session=vertical', 'claude:Weekly=vertical'], 'horizontal');
  assert.equal(selected.icon, false);
  assert.deepEqual(selected.meters, [{name: 'Session', orientation: 'vertical'}]);
  assert.equal(selected.activity, false);
  assert.equal(panelDescription(data, selected), 'Claude, Session: 20% used');
  assert.deepEqual(visibleComponents(data, [], [], 'horizontal').meters, []);
});

test('unconfigured and expired windows stay configurable without showing fabricated use', () => {
  const data = {id: 'codex', label: 'Codex', status: 'error', sessions: []};
  const choices = componentChoices(data);
  assert.deepEqual(choices.map(c => c.id), ['codex:icon', 'codex:Session', 'codex:Weekly']);
  const display = visibleComponents(data, ['codex:Weekly'], [], 'vertical');
  assert.deepEqual(display.meters, [{name: 'Weekly', orientation: 'vertical'}]);
  assert.equal(panelDescription(data, display), 'Codex, Weekly: unavailable');
});

test('Antigravity model groups are independent of the aggregate and one another', () => {
  const data = {id: 'antigravity', label: 'Antigravity', status: 'ok', sessions: [
    {name: 'Session', usedPercent: 90}, {name: 'Gemini · 5h', usedPercent: 12},
    {name: 'Claude and GPT · 5h', usedPercent: 90},
  ]};
  const choices = componentChoices(data);
  assert.ok(choices.some(c => c.id === 'antigravity:Gemini · 5h'));
  assert.ok(choices.some(c => c.id === 'antigravity:Gemini · weekly'));
  const display = visibleComponents(data, ['antigravity:icon', 'antigravity:Gemini · 5h'],
    ['antigravity:Gemini · 5h=vertical'], 'horizontal');
  assert.deepEqual(display.meters, [{name: 'Gemini · 5h', orientation: 'vertical'}]);
  assert.equal(display.icon, true);
  assert.equal(panelDescription(data, display), 'Antigravity, Gemini · 5h: 12% used');
});

test('OpenCode activity can be hidden independently of its icon; unknown ids are ignored', () => {
  const data = {id: 'opencode', label: 'OpenCode', status: 'ok', totalTokens: 1200, sessions: []};
  assert.deepEqual(componentChoices(data).map(c => c.id), ['opencode:icon', 'opencode:activity']);
  assert.deepEqual(visibleComponents(data, ['opencode:activity', 'opencode:unknown'], [], 'horizontal'),
    {icon: false, activity: true, meters: []});
  assert.equal(panelDescription(data, {icon: false, activity: true, meters: []}), 'OpenCode, 1,200 tokens in 7 days');
});
