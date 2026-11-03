/**
 * Gemini provider — reads gcloud/Gemini CLI credentials and config.
 *
 * Looks for data in:
 *   ~/.config/gcloud/ — Google Cloud CLI credentials
 *   ~/.config/gemini/ — Gemini CLI config (if present)
 *
 * Supports optional API key mode via GSettings for direct API access.
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../core/provider.js';

const HOME = GLib.get_home_dir();
const GCLOUD_DIR = GLib.build_filenamev([HOME, '.config', 'gcloud']);
const GEMINI_DIR = GLib.build_filenamev([HOME, '.config', 'gemini']);

export default class GeminiProvider extends BaseProvider {
  get id() { return 'gemini'; }
  get label() { return 'Gemini'; }
  get icon() { return '✧'; }
  get authSource() { return AuthSource.CLI; }

  get capabilities() {
    return makeCapabilities({
      hasUsage: true,
      hasStatus: true,
      hasDashboard: true,
    });
  }

  get privacySources() {
    return [
      `${GCLOUD_DIR}/application_default_credentials.json`,
      `${GEMINI_DIR}/`,
    ];
  }

  get isConfigured() {
    const gcloudCreds = Gio.File.new_for_path(
      GLib.build_filenamev([GCLOUD_DIR, 'application_default_credentials.json']),
    );
    const geminiDir = Gio.File.new_for_path(GEMINI_DIR);
    return gcloudCreds.query_exists(null) || geminiDir.query_exists(null);
  }

  async fetch(_settings) {
    const base = {id: this.id, label: this.label, icon: this.icon};

    if (!this.isConfigured) {
      return makeResult({
        ...base,
        status: ProviderStatus.UNCONFIGURED,
        error: 'No gcloud credentials or Gemini CLI config found. Run `gcloud auth application-default login` or install Gemini CLI.',
        lastUpdated: new Date(),
      });
    }

    try {
      const data = this._readGeminiData();
      return makeResult({
        ...base,
        plan: data.plan || '',
        status: ProviderStatus.OK,
        lastUpdated: new Date(),
        sessions: data.sessions,
        cost: data.cost,
        dashboardUrl: 'https://aistudio.google.com',
        statusUrl: 'https://status.cloud.google.com',
      });
    } catch (err) {
      return makeResult({
        ...base,
        status: ProviderStatus.ERROR,
        error: err.message,
        lastUpdated: new Date(),
      });
    }
  }

  _readGeminiData() {
    const result = {
      plan: '',
      sessions: [],
      cost: {today: '$ 0.00', last30d: '$ 0.00', tokens: '0'},
    };

    // Try Gemini CLI usage file
    const usagePaths = [
      GLib.build_filenamev([GEMINI_DIR, 'usage.json']),
      GLib.build_filenamev([GEMINI_DIR, 'state.json']),
    ];

    for (const path of usagePaths) {
      const file = Gio.File.new_for_path(path);
      if (!file.query_exists(null)) continue;

      try {
        const [ok, contents] = file.load_contents(null);
        if (!ok) continue;
        const text = new TextDecoder().decode(contents);
        const data = JSON.parse(text);
        return this._parseUsageData(data);
      } catch {
        // Ignore
      }
    }

    // Credentials exist but no usage data
    result.sessions.push({
      name: 'Session',
      usedPercent: 0,
      resetLabel: 'Credentials found — no usage data',
    });
    return result;
  }

  _parseUsageData(data) {
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
}
