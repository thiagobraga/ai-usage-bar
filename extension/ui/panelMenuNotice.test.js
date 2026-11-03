import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerNotice} from './panelMenu.js';

test('usage errors keep the provider-specific recovery step', () => {
  assert.match(providerNotice({id: 'opencode', status: 'ok', quotaError: 'unsupported-auth'}), /ChatGPT OAuth/);
  assert.equal(providerNotice({id: 'opencode', status: 'ok'}), '');
  assert.match(providerNotice({id: 'antigravity', status:'error', errorKind:'expired'}), /agy/);
  assert.match(providerNotice({id: 'antigravity', status:'error', errorKind:'locked'}), /keyring/);
  assert.equal(providerNotice({id: 'claude', status:'ok'}), '');
});
