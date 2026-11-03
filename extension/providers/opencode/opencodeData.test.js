import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOpenCodeStats} from './opencodeData.js';

test('groups OpenCode model stats by provider and sums token classes', () => {
  const data = {models: [
    {model: {providerID: 'openai', id: 'a'}, tokens: {input: 10, output: 5, reasoning: 2, cache: {read: 3, write: 1}}, cost: 1},
    {model: {providerID: 'openai', id: 'b'}, tokens: {input: 2, output: 1, reasoning: 0, cache: {read: 0, write: 0}}, cost: 2},
    {model: {providerID: 'ollama', id: 'c'}, tokens: {input: 4, output: 1}, cost: 0},
  ]};
  assert.deepEqual(parseOpenCodeStats(data), [
    {provider: 'openai', tokens: 24, cost: 3, models: 2},
    {provider: 'ollama', tokens: 5, cost: 0, models: 1},
  ]);
});

test('rejects missing or malformed statistics', () => {
  assert.equal(parseOpenCodeStats({}), null);
  assert.equal(parseOpenCodeStats({models: [{model: {providerID: 'x'}, tokens: {input: -1}}]}), null);
  assert.deepEqual(parseOpenCodeStats({models: []}), []);
});

test('includes connected providers with no activity as zero', () => {
  assert.deepEqual(parseOpenCodeStats({models: []}, ['openai', 'ollama']), [
    {provider: 'ollama', tokens: 0, cost: 0, models: 0},
    {provider: 'openai', tokens: 0, cost: 0, models: 0},
  ]);
});
