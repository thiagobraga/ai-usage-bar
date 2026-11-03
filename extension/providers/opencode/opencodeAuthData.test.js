import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {selectOpenAICredential, selectOpenAIAuth} from './opencodeAuthData.js';

const oauth = (access, accountID, expires = Date.now() + 60000) =>
  ({type: 'oauth', methodID: 'chatgpt-browser', access, expires, metadata: {accountID}});

test('selects only the active OpenCode OpenAI OAuth credential', () => {
  const rows = [
    {active: 0, value: oauth('other', 'account-a')},
    {active: 1, value: oauth('selected', 'account-b')},
  ];
  assert.deepEqual(selectOpenAICredential(rows), {access: 'selected', accountID: 'account-b'});
  assert.deepEqual(selectOpenAICredential([rows[0]]), {access: 'other', accountID: 'account-a'});
});

test('selects a migrated OpenCode credential when no active flag has been set', () => {
  assert.deepEqual(selectOpenAICredential([{active: null, value: oauth('migrated', 'account-a')}]),
    {access: 'migrated', accountID: 'account-a'});
});

test('rejects API keys, expired credentials, absent account IDs and malformed rows', () => {
  for (const value of [null, {type: 'key', key: 'secret'}, oauth('expired', 'a', 1),
    oauth('no-account', ''), {...oauth('bad-method', 'a'), methodID: 'other'},
    {...oauth('blank', 'a'), access: ' '}])
    assert.equal(selectOpenAICredential([{active: 1, value}]), null);
  assert.equal(selectOpenAICredential([{active: 1, value: oauth('ready', 'a', 1001)}], 1000).access, 'ready');
});

test('active token-sharing is unsupported rather than missing or a fallback to an inactive account', () => {
  const rows = [
    {active: 1, value: oauth('shared', '', Date.now() + 60000)},
    {active: 0, value: oauth('old', 'other-account')},
  ];
  rows[0].value.methodID = 'chatgpt-token-sharing';
  assert.deepEqual(selectOpenAIAuth(rows), {credential: null, issue: 'unsupported-auth'});
  assert.equal(selectOpenAICredential(rows), null);
});

test('GJS reports active token-sharing as unsupported without requesting ChatGPT usage', t => {
  if (spawnSync('gjs', ['--version']).error || spawnSync('sqlite3', ['-version']).error) {
    t.skip('GJS or sqlite3 unavailable'); return;
  }
  const dir = mkdtempSync('/tmp/opencode/opencode-token-sharing-test-');
  try {
    mkdirSync(join(dir, 'bin'));
    const db = join(dir, 'opencode.db');
    const shared = {...oauth('shared', ''), methodID: 'chatgpt-token-sharing', metadata: {clientID: 'client'}};
    assert.equal(spawnSync('sqlite3', [db, `CREATE TABLE credential (integration_id TEXT, active INTEGER, value TEXT, time_created INTEGER);
      INSERT INTO credential VALUES ('openai', 1, '${JSON.stringify(shared)}', 2);
      INSERT INTO credential VALUES ('openai', 0, '${JSON.stringify(oauth('old', 'other-account'))}', 1);`]).status, 0);
    writeFileSync(join(dir, 'bin', 'opencode'), `#!/bin/sh\nprintf '%s\\n' '${db}'\n`, {mode: 0o700});
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {fetchOpenAIQuota} from ${JSON.stringify(new URL('./opencodeQuota.js', import.meta.url).href)};
      import {readOpenCodeAuth} from ${JSON.stringify(new URL('./opencodeAuth.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      let code = null;
      try {
        await fetchOpenAIQuota({readAuth: readOpenCodeAuth, request: () => { throw new Error('must not request'); }},
          new Gio.Cancellable());
      } catch (error) { code = error.code; }
      if (code !== 'unsupported-auth') throw new Error('token-sharing did not remain unavailable: ' + code);`);
    const check = spawnSync('gjs', ['-m', script], {env: {...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, XDG_DATA_HOME: dir}, encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('legacy auth.json is supported only for OAuth with an account ID', () => {
  assert.deepEqual(selectOpenAICredential({openai: {type: 'oauth', access: 'legacy',
    accountId: 'legacy-account', expires: Date.now() + 60000}}),
  {access: 'legacy', accountID: 'legacy-account'});
  assert.equal(selectOpenAICredential({openai: {type: 'api', key: 'secret'}}), null);
});

test('GJS reads active OAuth from a read-only OpenCode V2 database', t => {
  if (spawnSync('gjs', ['--version']).error || spawnSync('sqlite3', ['-version']).error) {
    t.skip('GJS or sqlite3 unavailable'); return;
  }
  const dir = mkdtempSync('/tmp/opencode/opencode-oauth-test-');
  try {
    mkdirSync(join(dir, 'bin'));
    const db = join(dir, 'opencode.db');
    const sql = `CREATE TABLE credential (integration_id TEXT, active INTEGER, value TEXT, time_created INTEGER);
      INSERT INTO credential VALUES ('openai', 0, '${JSON.stringify(oauth('old', 'account-old'))}', 1);
      INSERT INTO credential VALUES ('openai', 1, '${JSON.stringify(oauth('current', 'account-current'))}', 2);`;
    assert.equal(spawnSync('sqlite3', [db, sql]).status, 0);
    const cli = join(dir, 'bin', 'opencode');
    writeFileSync(cli, `#!/bin/sh\nprintf '%s\\n' '${db}'\n`, {mode: 0o700});
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {readOpenCodeAuth} from ${JSON.stringify(new URL('./opencodeAuth.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      const value = await readOpenCodeAuth(new Gio.Cancellable());
      if (value?.access !== 'current' || value?.accountID !== 'account-current') throw new Error('wrong credential');`);
    const check = spawnSync('gjs', ['-m', script], {env: {...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, XDG_DATA_HOME: dir}, encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('GJS OpenCode quota fetch uses its own OAuth account and never Codex credentials', t => {
  if (spawnSync('gjs', ['--version']).error) { t.skip('GJS unavailable'); return; }
  const dir = mkdtempSync('/tmp/opencode/opencode-quota-test-');
  try {
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {fetchOpenAIQuota} from ${JSON.stringify(new URL('./opencodeQuota.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      const calls = [];
      const quota = await fetchOpenAIQuota({readAuth: async () => ({access: 'opencode-token', accountID: 'opencode-account'}),
        request: async (url, headers) => { calls.push({url, headers}); return {plan_type: 'plus', rate_limit: {
          primary_window: {used_percent: 22, limit_window_seconds: 18000},
          secondary_window: {used_percent: 38, limit_window_seconds: 604800}}}; }}, new Gio.Cancellable());
      if (quota.plan !== 'plus' || quota.sessions[0].usedPercent !== 22 ||
          calls.length !== 1 || calls[0].headers.Authorization !== 'Bearer opencode-token' ||
          calls[0].headers['ChatGPT-Account-Id'] !== 'opencode-account') throw new Error('wrong account');`);
    const check = spawnSync('gjs', ['-m', script], {encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('GJS does not use stale legacy auth.json when a V2 database exists', t => {
  if (spawnSync('gjs', ['--version']).error || spawnSync('sqlite3', ['-version']).error) {
    t.skip('GJS or sqlite3 unavailable'); return;
  }
  const dir = mkdtempSync('/tmp/opencode/opencode-auth-isolation-');
  try {
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'opencode'));
    const db = join(dir, 'opencode.db');
    assert.equal(spawnSync('sqlite3', [db, `CREATE TABLE credential (integration_id TEXT, active INTEGER, value TEXT, time_created INTEGER);
      INSERT INTO credential VALUES ('openai', 1, '{"type":"key","key":"not-oauth"}', 1);`]).status, 0);
    writeFileSync(join(dir, 'opencode', 'auth.json'), JSON.stringify({openai: {type: 'oauth',
      access: 'stale-legacy', accountId: 'old-account', expires: Date.now() + 60000}}));
    writeFileSync(join(dir, 'bin', 'opencode'), `#!/bin/sh\nprintf '%s\\n' '${db}'\n`, {mode: 0o700});
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {readOpenCodeAuth} from ${JSON.stringify(new URL('./opencodeAuth.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      if (await readOpenCodeAuth(new Gio.Cancellable()) !== null) throw new Error('used stale credential');`);
    const check = spawnSync('gjs', ['-m', script], {env: {...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, XDG_DATA_HOME: dir}, encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('GJS reads legacy OpenCode V1 OAuth when the V2 database command is unsupported', t => {
  if (spawnSync('gjs', ['--version']).error) { t.skip('GJS unavailable'); return; }
  const dir = mkdtempSync('/tmp/opencode/opencode-legacy-test-');
  try {
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'opencode'));
    writeFileSync(join(dir, 'opencode', 'auth.json'), JSON.stringify({openai: {type: 'oauth',
      access: 'legacy-token', accountId: 'legacy-account', expires: Date.now() + 60000}}));
    writeFileSync(join(dir, 'bin', 'opencode'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 1.3.0; else exit 1; fi\n`, {mode: 0o700});
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {readOpenCodeAuth} from ${JSON.stringify(new URL('./opencodeAuth.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      const value = await readOpenCodeAuth(new Gio.Cancellable());
      if (value?.access !== 'legacy-token') throw new Error('legacy OAuth not read');`);
    const check = spawnSync('gjs', ['-m', script], {env: {...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, XDG_DATA_HOME: dir}, encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('GJS does not fall back to old auth.json when a V2 database is missing', t => {
  if (spawnSync('gjs', ['--version']).error) { t.skip('GJS unavailable'); return; }
  const dir = mkdtempSync('/tmp/opencode/opencode-missing-db-test-');
  try {
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'opencode'));
    writeFileSync(join(dir, 'opencode', 'auth.json'), JSON.stringify({openai: {type: 'oauth',
      access: 'old-token', accountId: 'old-account', expires: Date.now() + 60000}}));
    writeFileSync(join(dir, 'bin', 'opencode'), `#!/bin/sh\nprintf '%s\\n' '${join(dir, 'absent.db')}'\n`, {mode: 0o700});
    const script = join(dir, 'check.mjs');
    writeFileSync(script, `import {readOpenCodeAuth} from ${JSON.stringify(new URL('./opencodeAuth.js', import.meta.url).href)};
      import Gio from 'gi://Gio';
      if (await readOpenCodeAuth(new Gio.Cancellable()) !== null) throw new Error('used stale credential');`);
    const check = spawnSync('gjs', ['-m', script], {env: {...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`, XDG_DATA_HOME: dir}, encoding: 'utf8', timeout: 10000});
    assert.equal(check.status, 0, check.stderr || check.error?.message);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
