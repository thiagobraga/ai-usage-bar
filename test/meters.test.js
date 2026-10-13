import {test} from 'node:test';
import assert from 'node:assert/strict';
import {meterValue, meterSeverity, meterColor, unicodeSegments, meterOrientation, usageSummary} from '../extension/meterModel.js';

const result = (percent, status = 'ok') => ({label: 'Claude', status,
  sessions: [{name: 'Session', usedPercent: percent}, {name: 'Weekly', usedPercent: 60}]});

test('missing, invalid and failed usage never looks like zero', () => {
  for (const value of [undefined, null, NaN, Infinity, '12'])
    assert.equal(meterValue(result(value), 'Session'), null);
  for (const status of ['error', 'unconfigured'])
    assert.equal(meterValue(result(30, status), 'Session'), null);
  assert.equal(meterValue(result(30), 'Unknown'), null);
  assert.equal(meterValue(null, 'Session'), null);
  assert.equal(unicodeSegments(null), '—');
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

test('default orientations match references; explicit overrides work', () => {
  assert.equal(meterOrientation('colored', 'auto'), 'vertical');
  assert.equal(meterOrientation('unicode', 'auto'), 'horizontal');
  assert.equal(meterOrientation('colored', 'horizontal'), 'horizontal');
  assert.equal(meterOrientation('unicode', 'vertical'), 'vertical');
});

test('accessible summaries distinguish windows and flag stale observations', () => {
  assert.equal(usageSummary(result(20)), 'Claude — Session: 20% used, Weekly: 60% used');
  assert.match(usageSummary(result(20, 'stale')), /\(stale\)$/);
  assert.match(usageSummary(result(null)), /Session: unavailable/);
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
