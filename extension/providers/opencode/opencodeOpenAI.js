import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../../core/provider.js';
import { readOpenCodeAuth } from './opencodeAuth.js';
import { parseCodexUsage } from '../shared/usageData.js';
import { UsageError, UsageIO, getUsage } from '../shared/usageIO.js';

const ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

export default class OpenCodeOpenAIProvider extends BaseProvider {
  constructor({readAuth = readOpenCodeAuth, request = getUsage} = {}) {
    super();
    this._io = new UsageIO();
    this._readAuth = readAuth;
    this._request = request;
  }
  get id() { return 'opencode-openai'; }
  get label() { return 'OpenCode · OpenAI'; }
  get icon() { return '◌'; }
  get authSource() { return AuthSource.LOCAL_FILE; }
  get capabilities() { return makeCapabilities({hasUsage: true, hasReset: true, hasDashboard: true}); }
  get privacySources() { return ['OpenCode active OpenAI OAuth credential (local database or legacy auth.json)', ENDPOINT]; }

  async fetch(_settings) {
    const base = {id: this.id, label: this.label, icon: this.icon, cost: null,
      source: 'OpenCode OpenAI OAuth usage API', dashboardUrl: 'https://chatgpt.com/codex/settings/usage',
      statusUrl: 'https://status.openai.com'};
    try {
      return await this._io.run(async cancellable => {
        const credential = await this._readAuth(cancellable);
        if (!credential) throw new UsageError('missing');
        const data = await this._request(ENDPOINT, {
          Authorization: `Bearer ${credential.access}`,
          'ChatGPT-Account-Id': credential.accountID,
        }, cancellable);
        const sessions = parseCodexUsage(data);
        if (!sessions.length) throw new UsageError('no-usage');
        return makeResult({...base, sessions, status: ProviderStatus.OK, lastUpdated: new Date(),
          plan: typeof data.plan_type === 'string' ? data.plan_type : ''});
      });
    } catch (error) {
      const code = error instanceof UsageError ? error.code : 'unavailable';
      return makeResult({...base,
        status: ['missing', 'unsupported-auth', 'expired'].includes(code)
          ? ProviderStatus.UNCONFIGURED : ProviderStatus.ERROR,
        errorKind: code, error: code === 'unsupported-auth'
          ? 'OpenCode token-sharing cannot show ChatGPT plan quota. Use a ChatGPT OAuth sign-in in OpenCode.'
          : `OpenCode OpenAI usage: ${code}. ${['missing', 'expired', 'auth-error'].includes(code)
            ? 'Sign in to ChatGPT with OpenCode.' : 'Usage unavailable.'}`});
    }
  }
  destroy() { this._io.destroy(); }
}
