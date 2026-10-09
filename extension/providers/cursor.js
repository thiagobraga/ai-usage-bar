/**
 * Cursor provider — stub for future manual cookie/API integration.
 *
 * Cursor doesn't expose a public API for usage data.  A future version
 * may support manual cookie/header entry or a companion script.
 * For now this provider is always in UNCONFIGURED state with guidance.
 */

import {BaseProvider, AuthSource, ProviderStatus, makeResult, makeCapabilities} from '../provider.js';

export default class CursorProvider extends BaseProvider {
  get id() { return 'cursor'; }
  get label() { return 'Cursor'; }
  get icon() { return '◆'; }
  get authSource() { return AuthSource.MANUAL_COOKIE; }

  get capabilities() {
    return makeCapabilities({
      hasUsage: true,
      hasReset: true,
      hasDashboard: true,
    });
  }

  get privacySources() {
    return ['Cursor usage API (not yet implemented — requires manual cookie/header)'];
  }

  get isConfigured() {
    // Future: check if a manual cookie/header has been stored in settings
    return false;
  }

  async fetch(_settings) {
    return makeResult({
      id: this.id,
      label: this.label,
      icon: this.icon,
      status: ProviderStatus.UNCONFIGURED,
      error: 'Cursor integration requires manual cookie/API setup. Coming in a future version.',
      lastUpdated: new Date(),
      dashboardUrl: 'https://cursor.com/settings',
      statusUrl: null,
    });
  }
}
