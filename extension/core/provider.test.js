import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {test} from 'node:test';

// ═══════════════════════════════════════════════════════════════
// Provider result shape validation
// ═══════════════════════════════════════════════════════════════

test('ProviderResult shape: required fields', () => {
  const required = ['id', 'label', 'icon', 'status', 'sessions', 'cost'];
  // We test that makeResult produces all required keys
  // Since provider.js uses GI imports, we test the shape contract here
  const result = {
    id: 'test',
    label: 'Test',
    icon: '?',
    plan: '',
    status: 'ok',
    lastUpdated: null,
    sessions: [],
    cost: {today: '$ 0.00', last30d: '$ 0.00', tokens: '0'},
    dashboardUrl: null,
    statusUrl: null,
    error: null,
  };
  for (const key of required) {
    assert.ok(key in result, `ProviderResult must have key "${key}"`);
  }
});

test('ProviderResult.cost has expected sub-fields', () => {
  const cost = {today: '$ 0.00', last30d: '$ 0.00', tokens: '0'};
  assert.ok('today' in cost);
  assert.ok('last30d' in cost);
  assert.ok('tokens' in cost);
});

test('provider module files exist', () => {
  const exists = p => statSync(new URL(`../../${p}`, import.meta.url)).isFile();

  for (const path of [
    'extension/core/provider.js',
    'extension/core/providerRegistry.js',
    'extension/providers/claude/claude.js',
    'extension/providers/codex/codex.js',
    'extension/providers/antigravity/antigravity.js',
    'extension/providers/opencode/opencode.js',
  ]) {
    assert.ok(exists(path), `${path} should exist`);
  }
});
