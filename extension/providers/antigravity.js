import Secret from 'gi://Secret';
import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../core/provider.js';
import { credentialState, parseAntigravityQuota } from './usageData.js';
import { UsageError, UsageIO, asyncCall, getUsage } from './usageIO.js';

// Google AI subscription quota as shown by Antigravity. The endpoint only
// answers clients that identify as Antigravity.
const API = 'https://cloudcode-pa.googleapis.com/v1internal';
const KEYRING = {service: 'gemini', username: 'antigravity'};
const SCHEMA = Secret.Schema.new('org.freedesktop.Secret.Generic', Secret.SchemaFlags.DONT_MATCH_NAME,
  {service: Secret.SchemaAttributeType.STRING, username: Secret.SchemaAttributeType.STRING});

// Search without UNLOCK so the Shell never shows a keyring prompt.
async function readCredential(cancellable) {
  const [item] = await new Promise((resolve, reject) => Secret.password_search(SCHEMA, KEYRING,
    Secret.SearchFlags.NONE, cancellable, (_source, result) => {
      try { resolve(Secret.password_search_finish(result)); } catch (error) { reject(error); }
    }));
  if (!item) throw new UsageError('missing');
  if (item.locked) throw new UsageError('locked');
  const value = await asyncCall(item, 'retrieve_secret', 'retrieve_secret_finish', [cancellable]);
  if (!value) throw new UsageError('locked');
  try { return JSON.parse(value.get_text()); } catch { throw new UsageError('invalid-credentials'); }
}

export default class AntigravityProvider extends BaseProvider {
  constructor() { super(); this._io = new UsageIO(); }
  get id() { return 'antigravity'; }
  get label() { return 'Antigravity'; }
  get icon() { return '◭'; }
  get authSource() { return AuthSource.OAUTH; }
  get capabilities() { return makeCapabilities({hasUsage: true, hasReset: true, hasStatus: true, hasDashboard: true}); }
  get privacySources() { return ['GNOME keyring: Antigravity CLI sign-in', API]; }

  async fetch(_settings) {
    const base = {id: this.id, label: this.label, icon: this.icon, cost: null,
      source: 'Antigravity quota API', dashboardUrl: 'https://antigravity.google',
      statusUrl: 'https://status.cloud.google.com'};
    try {
      return await this._io.run(async cancellable => {
        const token = (await readCredential(cancellable))?.token;
        const state = credentialState(token?.access_token, Date.parse(token?.expiry));
        if (state !== 'ready') throw new UsageError(state);
        const headers = {Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'antigravity'};
        const [data, account] = await Promise.all([
          getUsage(`${API}:retrieveUserQuotaSummary`, headers, cancellable, {}),
          getUsage(`${API}:loadCodeAssist`, headers, cancellable,
            {metadata: {ideType: 'ANTIGRAVITY', pluginType: 'GEMINI'}}).catch(() => null),
        ]);
        const sessions = parseAntigravityQuota(data);
        if (!sessions.length) throw new UsageError('no-usage');
        const plan = account?.paidTier?.name ?? account?.currentTier?.name;
        return makeResult({...base, sessions, status: ProviderStatus.OK, lastUpdated: new Date(),
          plan: typeof plan === 'string' ? plan : ''});
      });
    } catch (error) {
      const code = error instanceof UsageError ? error.code : 'unavailable';
      const hint = code === 'locked' ? 'Unlock the GNOME keyring.'
        : ['expired', 'auth-error', 'missing'].includes(code) ? 'Run the Antigravity CLI (agy) to refresh its sign-in.'
        : 'Usage unavailable.';
      return makeResult({...base, status: code === 'missing' ? ProviderStatus.UNCONFIGURED : ProviderStatus.ERROR,
        errorKind: code, errorDetail: error?.detail ?? '', error: `Antigravity usage: ${code}. ${hint}`});
    }
  }
  destroy() { this._io.destroy(); }
}
