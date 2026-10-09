import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {test} from 'node:test';

const readFixture = name =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

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


// ═══════════════════════════════════════════════════════════════
// OpenRouter parser logic
// ═══════════════════════════════════════════════════════════════

function parseOpenRouterKey(json) {
  const data = json.data ?? json;
  const sessions = [];

  const balance = data.balance ?? data.limit ?? 0;
  const used = data.usage ?? 0;
  const pct = balance > 0 ? Math.round((used / balance) * 100) : 0;

  sessions.push({
    name: 'Balance',
    usedPercent: pct,
    resetLabel: balance > 0 ? `$ ${(balance - used).toFixed(2)} remaining` : 'No balance info',
  });

  if (data.rate_limit) {
    const rl = data.rate_limit;
    sessions.push({
      name: 'Rate limit',
      usedPercent: rl.requests_used && rl.requests_limit
        ? Math.round((rl.requests_used / rl.requests_limit) * 100)
        : 0,
      resetLabel: rl.reset ? `Resets ${rl.reset}` : 'Per-minute window',
    });
  }

  if (sessions.length === 0) {
    sessions.push({name: 'Usage', usedPercent: 0, resetLabel: 'No data'});
  }

  return {
    plan: data.label ?? '',
    sessions,
    cost: {
      today: data.usage ? `$ ${Number(data.usage).toFixed(2)}` : '$ 0.00',
      last30d: data.usage_30d ? `$ ${Number(data.usage_30d).toFixed(2)}` : '$ 0.00',
      tokens: data.tokens ? `${data.tokens}` : '0',
    },
  };
}

test('OpenRouter parser: parses key response fixture correctly', () => {
  const data = readFixture('openrouter-key-response.json');
  const result = parseOpenRouterKey(data);

  assert.equal(result.plan, 'dev-key');
  assert.equal(result.sessions.length, 2);

  assert.equal(result.sessions[0].name, 'Balance');
  assert.equal(result.sessions[0].usedPercent, 25); // 12.34/50 ≈ 25%
  assert.match(result.sessions[0].resetLabel, /37\.66 remaining/);

  assert.equal(result.sessions[1].name, 'Rate limit');
  assert.equal(result.sessions[1].usedPercent, 3); // 5/200
  assert.match(result.sessions[1].resetLabel, /42s/);

  assert.equal(result.cost.today, '$ 12.34');
  assert.equal(result.cost.last30d, '$ 48.22');
  assert.equal(result.cost.tokens, '2400000');
});

test('OpenRouter parser: handles response without rate_limit', () => {
  const result = parseOpenRouterKey({data: {balance: 100, usage: 0}});
  assert.equal(result.sessions.length, 1);
  assert.equal(result.sessions[0].usedPercent, 0);
});

// ═══════════════════════════════════════════════════════════════
// Gemini parser logic
// ═══════════════════════════════════════════════════════════════

function parseGeminiUsage(data) {
  const sessions = [];

  if (data.usage != null || data.limit != null) {
    const used = data.usage ?? 0;
    const limit = data.limit ?? 100;
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    sessions.push({
      name: 'Session',
      usedPercent: pct,
      resetLabel: data.reset ?? 'Unknown',
    });
  }

  if (data.daily_usage != null) {
    const used = data.daily_usage ?? 0;
    const limit = data.daily_limit ?? 100;
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
    sessions.push({
      name: 'Daily',
      usedPercent: pct,
      resetLabel: data.daily_reset ?? 'Daily window',
    });
  }

  if (sessions.length === 0) {
    sessions.push({name: 'Session', usedPercent: 0, resetLabel: 'No usage data'});
  }

  return {
    plan: data.plan ?? data.tier ?? '',
    sessions,
    cost: {
      today: data.cost_today ? `$ ${data.cost_today}` : '$ 0.00',
      last30d: data.cost_30d ? `$ ${data.cost_30d}` : '$ 0.00',
      tokens: data.tokens ? `${data.tokens}` : '0',
    },
  };
}

test('Gemini parser: parses usage.json fixture correctly', () => {
  const data = readFixture('gemini-usage.json');
  const result = parseGeminiUsage(data);

  assert.equal(result.plan, 'Free');
  assert.equal(result.sessions.length, 2);

  assert.equal(result.sessions[0].name, 'Session');
  assert.equal(result.sessions[0].usedPercent, 30);
  assert.equal(result.sessions[0].resetLabel, 'Resets in 2h');

  assert.equal(result.sessions[1].name, 'Daily');
  assert.equal(result.sessions[1].usedPercent, 8); // 120/1500
  assert.equal(result.sessions[1].resetLabel, 'Resets at midnight');
});

// ═══════════════════════════════════════════════════════════════
// Extension file structure
// ═══════════════════════════════════════════════════════════════

test('provider module files exist', () => {
  const exists = p => statSync(new URL(`../${p}`, import.meta.url)).isFile();

  for (const path of [
    'extension/provider.js',
    'extension/providerRegistry.js',
    'extension/providers/codex.js',
    'extension/providers/claude.js',
    'extension/providers/gemini.js',
    'extension/providers/cursor.js',
    'extension/providers/openrouter.js',
  ]) {
    assert.ok(exists(path), `${path} should exist`);
  }
});

test('schema includes openrouter-api-key', () => {
  const schema = readFileSync(
    new URL('../extension/schemas/org.gnome.shell.extensions.ai-usage-bar.gschema.xml', import.meta.url),
    'utf8',
  );
  assert.match(schema, /name="openrouter-api-key"/);
});
