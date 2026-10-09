import GLib from 'gi://GLib';
import {BaseProvider, AuthSource, ProviderStatus, makeResult, makeCapabilities} from '../provider.js';
import {credentialState, parseCodexUsage} from './usageData.js';
import {UsageIO, UsageError, configDir, readJson, getUsage, tokenExpiry, latestCodexObservation} from './usageIO.js';

const ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';
export default class CodexProvider extends BaseProvider {
  constructor() { super(); this._io = new UsageIO(); }
  get id() { return 'codex'; }
  get label() { return 'Codex'; }
  get icon() { return '◌'; }
  get authSource() { return AuthSource.LOCAL_FILE; }
  get capabilities() { return makeCapabilities({hasUsage: true, hasReset: true, hasStatus: true, hasDashboard: true}); }
  get _directory() { return configDir('CODEX_HOME', '.codex'); }
  get privacySources() { return [`${this._directory}/auth.json`, `${this._directory}/sessions/`, ENDPOINT]; }

  async fetch(_settings) {
    // Reserve one second for fallback even if the live request times out.
    const deadline = GLib.get_monotonic_time() + 4000000;
    const base = {id: this.id, label: this.label, icon: this.icon, cost: null,
      source: 'Codex OAuth usage API', dashboardUrl: 'https://chatgpt.com/codex/settings/usage',
      statusUrl: 'https://status.openai.com'};
    let failure;
    try {
      return await this._io.run(async cancellable => {
        const tokens = (await readJson(`${this._directory}/auth.json`, cancellable))?.tokens;
        const state = credentialState(tokens?.access_token, tokenExpiry(tokens?.access_token));
        if (state !== 'ready') throw new UsageError(state);
        if (typeof tokens.account_id !== 'string' || !tokens.account_id.trim()) throw new UsageError('missing');
        const data = await getUsage(ENDPOINT, {
          Authorization: `Bearer ${tokens.access_token}`, 'ChatGPT-Account-Id': tokens.account_id,
        }, cancellable);
        const sessions = parseCodexUsage(data);
        if (!sessions.length) throw new UsageError('no-usage');
        return makeResult({...base, sessions, status: ProviderStatus.OK, lastUpdated: new Date(),
          plan: typeof data.plan_type === 'string' ? data.plan_type : ''});
      }, deadline - 1000000);
    } catch (error) { failure = error instanceof UsageError ? error.code : 'unavailable'; }
    if (failure !== 'cancelled' && !this._io.destroyed) {
      try {
        const local = await this._io.run(
          cancellable => latestCodexObservation(`${this._directory}/sessions`, cancellable), deadline);
        if (local) return makeResult({...base, ...local, status: ProviderStatus.STALE, errorKind: failure,
          error: `Live Codex usage: ${failure}. Showing a local CLI observation; it may belong to a previous login.`});
      } catch { /* Preserve the live failure; never replace unavailable usage with zero. */ }
    }
    return makeResult({...base, status: failure === 'missing' ? ProviderStatus.UNCONFIGURED : ProviderStatus.ERROR,
      errorKind: failure, error: `Codex usage: ${failure}. ${['expired', 'auth-error', 'missing'].includes(failure) ? 'Sign in again with the Codex CLI.' : 'Usage unavailable.'}`});
  }
  destroy() { this._io.destroy(); }
}
