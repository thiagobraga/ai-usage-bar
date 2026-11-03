import GLib from 'gi://GLib';
import { AuthSource, BaseProvider, ProviderStatus, makeCapabilities, makeResult } from '../../core/provider.js';
import { parseOpenCodeStats } from './opencodeData.js';
import { UsageError, UsageIO, readJson } from '../shared/usageIO.js';
import { findOpenCode, openCodeAuthPath, runCommand } from './opencodeCli.js';

const OPENCODE_TIMEOUT_MS = 20000;

export default class OpenCodeProvider extends BaseProvider {
  constructor() { super(); this._io = new UsageIO(); }
  get id() { return 'opencode'; }
  get label() { return 'OpenCode'; }
  get icon() { return 'O'; }
  get authSource() { return AuthSource.CLI; }
  // `opencode stats` takes ~6s on a warm cache.
  get timeoutMs() { return OPENCODE_TIMEOUT_MS; }
  get capabilities() { return makeCapabilities({hasUsage: true}); }
  get privacySources() { return ['OpenCode local session statistics (opencode stats --json)',
    openCodeAuthPath()]; }

  async fetch(_settings) {
    const base = {id: this.id, label: this.label, icon: this.icon,
      source: 'OpenCode local sessions, last 7 days', dashboardUrl: 'https://opencode.ai'};
    try {
      const deadline = GLib.get_monotonic_time() + (OPENCODE_TIMEOUT_MS - 1000) * 1000;
      return await this._io.run(async cancellable => {
        const executable = findOpenCode(cancellable);
        if (!executable) throw new UsageError('missing');
        const output = await runCommand([executable, 'stats', '--days', '7', '--models', '--cost', '--json'],
          cancellable, 1024 * 1024);
        let data;
        try { data = JSON.parse(output); } catch { throw new UsageError('invalid-response'); }
        let connected = [];
        try { connected = Object.keys(await readJson(openCodeAuthPath(), cancellable)); }
        catch { /* Stats can still represent providers configured through the environment. */ }
        const activity = parseOpenCodeStats(data, connected);
        if (!activity) throw new UsageError('invalid-response');
        return makeResult({...base, status: ProviderStatus.OK, lastUpdated: new Date(), activity,
          totalTokens: activity.reduce((sum, item) => sum + item.tokens, 0)});
      }, deadline);
    } catch (error) {
      const code = error instanceof UsageError ? error.code : 'unavailable';
      return makeResult({...base, status: code === 'missing' ? ProviderStatus.UNCONFIGURED : ProviderStatus.ERROR,
        errorKind: code, error: `OpenCode activity: ${code}.`});
    }
  }
  destroy() { this._io.destroy(); }
}
