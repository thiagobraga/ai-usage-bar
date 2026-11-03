import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setDebug, debugLog, describeError} from './debug.js';

test('describeError keeps class, message, and GError domain/code', () => {
  assert.equal(describeError(new TypeError('boom')), 'TypeError: boom');
  const gerror = Object.assign(new Error('refused'), {domain: 42, code: 7});
  assert.match(describeError(gerror), /Error: refused domain=42 code=7/);
  assert.equal(describeError(null), 'unknown error');
});

test('debugLog is silent unless enabled', () => {
  const lines = [];
  const original = console.log;
  console.log = line => lines.push(line);
  try {
    debugLog('t', 'off');
    setDebug(true);
    debugLog('t', 'on', 1);
    setDebug(false);
  } finally { console.log = original; }
  assert.deepEqual(lines, ['[ai-usage-bar] [debug] t: on 1']);
});
