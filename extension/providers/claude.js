import GLib from 'gi://GLib';
import { debugLog } from '../core/debug.js';
import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../core/provider.js';
import { credentialState, parseClaudeUsage } from './usageData.js';
import { UsageError, UsageIO, configDir, getUsage, readJson } from './usageIO.js';

const ENDPOINT = 'https://api.anthropic.com/api/oauth/usage';
export default class ClaudeProvider extends BaseProvider {
  constructor() { super(); this._io = new UsageIO(); }
  get id() { return 'claude'; }
  get label() { return 'Claude'; }
  get icon() { return '✺'; }
  get authSource() { return AuthSource.LOCAL_FILE; }
  get capabilities() { return makeCapabilities({hasUsage: true, hasReset: true, hasStatus: true, hasDashboard: true}); }
  get _credentialPath() { return GLib.build_filenamev([configDir('CLAUDE_CONFIG_DIR', '.claude'), '.credentials.json']); }
  get privacySources() { return [this._credentialPath, ENDPOINT]; }

  async fetch(_settings) {
    const base = {id: this.id, label: this.label, icon: this.icon, cost: null,
      source: 'Claude OAuth usage API', dashboardUrl: 'https://claude.ai/settings/usage',
      statusUrl: 'https://status.anthropic.com'};
    try {
      return await this._io.run(async cancellable => {
        const credential = (await readJson(this._credentialPath, cancellable))?.claudeAiOauth;
        const state = credentialState(credential?.accessToken, credential?.expiresAt);
        debugLog('claude', 'credential', this._credentialPath, 'state', state);
        if (state !== 'ready') throw new UsageError(state);
        const data = await getUsage(ENDPOINT, {
          Authorization: `Bearer ${credential.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20',
        }, cancellable);
        const sessions = parseClaudeUsage(data);
        if (!sessions.length) throw new UsageError('no-usage');
        return makeResult({...base, sessions, status: ProviderStatus.OK, lastUpdated: new Date(),
          plan: typeof credential.subscriptionType === 'string' ? credential.subscriptionType : ''});
      });
    } catch (error) {
      const code = error instanceof UsageError ? error.code : 'unavailable';
      return makeResult({...base, status: code === 'missing' ? ProviderStatus.UNCONFIGURED : ProviderStatus.ERROR,
        errorKind: code, errorDetail: error?.detail ?? '', error: `Claude usage: ${code}. ${['expired', 'auth-error', 'missing'].includes(code) ? 'Sign in again with the Claude CLI.' : 'Usage unavailable.'}`});
    }
  }
  destroy() { this._io.destroy(); }
}
