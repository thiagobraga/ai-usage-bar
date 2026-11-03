/**
 * OpenRouter provider — API key-based balance and usage.
 *
 * Uses the OpenRouter API to fetch:
 *   GET /api/v1/auth/key → balance, usage, rate limits
 *
 * The API key is stored in GSettings as `openrouter-api-key`.
 * This is the only provider that makes network calls in the MVP.
 */

import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../../core/provider.js';

const API_BASE = 'https://openrouter.ai';

export default class OpenRouterProvider extends BaseProvider {
  get id() { return 'openrouter'; }
  get label() { return 'OpenRouter'; }
  get icon() { return '⬡'; }
  get authSource() { return AuthSource.API_KEY; }

  get capabilities() {
    return makeCapabilities({
      hasUsage: true,
      hasCost: true,
      hasDashboard: true,
      hasStatus: true,
    });
  }

  get privacySources() {
    return [
      `${API_BASE}/api/v1/auth/key (balance, usage, rate limits)`,
    ];
  }

  _getApiKey(settings) {
    try {
      return settings?.get_string('openrouter-api-key') ?? '';
    } catch {
      return '';
    }
  }

  get isConfigured() {
    // We can't check settings here without the settings param,
    // so we return true and let fetch() handle the check.
    return true;
  }

  async fetch(settings) {
    const base = {id: this.id, label: this.label, icon: this.icon};
    const apiKey = this._getApiKey(settings);

    if (!apiKey) {
      return makeResult({
        ...base,
        status: ProviderStatus.UNCONFIGURED,
        error: 'No OpenRouter API key configured. Add it in Settings → Providers.',
        lastUpdated: new Date(),
        dashboardUrl: 'https://openrouter.ai/keys',
      });
    }

    try {
      const data = await this._fetchKeyInfo(apiKey);
      return makeResult({
        ...base,
        plan: data.plan || 'API',
        status: ProviderStatus.OK,
        lastUpdated: new Date(),
        sessions: data.sessions,
        cost: data.cost,
        dashboardUrl: 'https://openrouter.ai/activity',
        statusUrl: 'https://openrouter.ai',
      });
    } catch (err) {
      return makeResult({
        ...base,
        status: ProviderStatus.ERROR,
        error: err.message,
        lastUpdated: new Date(),
        dashboardUrl: 'https://openrouter.ai/activity',
      });
    }
  }

  /**
   * Call the OpenRouter auth/key endpoint.
   * @param {string} apiKey
   * @returns {Promise<{plan: string, sessions: Array, cost: object}>}
   */
  async _fetchKeyInfo(apiKey) {
    return new Promise((resolve, reject) => {
      try {
        const session = new Soup.Session();
        const message = Soup.Message.new('GET', `${API_BASE}/api/v1/auth/key`);
        message.get_request_headers().append('Authorization', `Bearer ${apiKey}`);
        message.get_request_headers().append('Content-Type', 'application/json');

        session.send_and_read_async(
          message,
          GLib.PRIORITY_DEFAULT,
          null,
          (_session, result) => {
            try {
              const bytes = session.send_and_read_finish(result);
              const status = message.get_status();

              if (status !== 200) {
                reject(new Error(`OpenRouter API returned ${status}`));
                return;
              }

              const text = new TextDecoder().decode(bytes.get_data());
              const json = JSON.parse(text);
              resolve(this._parseKeyResponse(json));
            } catch (err) {
              reject(err);
            }
          },
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  _parseKeyResponse(json) {
    const data = json.data ?? json;
    const sessions = [];

    // Balance/usage
    const balance = data.balance ?? data.limit ?? 0;
    const used = data.usage ?? 0;
    const pct = balance > 0 ? Math.round((used / balance) * 100) : 0;

    sessions.push({
      name: 'Balance',
      usedPercent: pct,
      resetLabel: balance > 0 ? `$ ${(balance - used).toFixed(2)} remaining` : 'No balance info',
    });

    // Rate limit info
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
}
