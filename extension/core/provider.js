/**
 * Provider abstraction for AI Usage Bar.
 *
 * Every AI provider extends BaseProvider and implements fetch() which returns
 * a ProviderResult.  The extension never talks to specific provider details
 * directly - only through this interface.
 */

/**
 * Auth source types - how the provider obtains credentials / data.
 * @enum {string}
 */
export const AuthSource = Object.freeze({
  NONE: 'none',
  API_KEY: 'api-key',
  CLI: 'cli',
  LOCAL_FILE: 'local-file',
  OAUTH: 'oauth',
  BROWSER_COOKIE: 'browser-cookie',
  MANUAL_COOKIE: 'manual-cookie',
});

/**
 * Provider status values.
 * @enum {string}
 */
export const ProviderStatus = Object.freeze({
  OK: 'ok',
  STALE: 'stale',
  ERROR: 'error',
  INCIDENT: 'incident',
  UNCONFIGURED: 'unconfigured',
});

/**
 * Create a blank ProviderResult with safe defaults.
 *
 * Shape:
 *   id           - provider identifier
 *   label        - human-readable name
 *   icon         - single character / emoji for panel
 *   plan         - subscription tier label ('Free', 'Max', 'Pro', etc.)
 *   status       - ProviderStatus value
 *   lastUpdated  - Date or null
 *   sessions     - [{name, usedPercent, resetLabel}]
 *   cost         - {today, last30d, tokens} (string amounts)
 *   dashboardUrl - URL string or null
 *   statusUrl    - URL string or null
 *   error        - error message string or null
 *
 * @param {Partial<ProviderResult>} overrides
 * @returns {ProviderResult}
 */
export function makeResult(overrides = {}) {
  return {
    id: '',
    label: '',
    icon: '?',
    plan: '',
    status: ProviderStatus.UNCONFIGURED,
    lastUpdated: null,
    sessions: [],
    cost: {today: '$ 0.00', last30d: '$ 0.00', tokens: '0'},
    dashboardUrl: null,
    statusUrl: null,
    error: null,
    ...overrides,
  };
}

/**
 * Capability flags - what data a provider can supply.
 *
 * @param {object} flags
 * @returns {ProviderCapabilities}
 */
export function makeCapabilities(flags = {}) {
  return {
    hasUsage: false,
    hasCost: false,
    hasReset: false,
    hasStatus: false,
    hasDashboard: false,
    ...flags,
  };
}

/**
 * Base class for all providers.  Subclasses MUST override:
 *   - get id()
 *   - get label()
 *   - get icon()
 *   - get capabilities()
 *   - get authSource()
 *   - async fetch(settings) → ProviderResult
 *
 * Optional overrides:
 *   - get isConfigured()  - default: true
 *   - get privacySources() - list of file paths / URLs the provider reads
 */
export class BaseProvider {
  /** @returns {string} Unique machine id, e.g. 'codex' */
  get id() {
    throw new Error('BaseProvider.id must be overridden');
  }

  /** @returns {string} Human-readable name */
  get label() {
    throw new Error('BaseProvider.label must be overridden');
  }

  /** @returns {string} Single character icon */
  get icon() {
    return '?';
  }

  /** @returns {ProviderCapabilities} */
  get capabilities() {
    return makeCapabilities();
  }

  /** @returns {AuthSource} */
  get authSource() {
    return AuthSource.NONE;
  }

  /** @returns {boolean} Whether the provider has enough config to attempt a fetch. */
  get isConfigured() {
    return true;
  }

  /**
   * Human-readable list of file paths and API endpoints this provider
   * accesses.  Shown in the Settings → Privacy panel.
   * @returns {string[]}
   */
  get privacySources() {
    return [];
  }

  /**
   * Fetch current data from the provider.  Must not throw - return an
   * error result instead.
   *
   * @param {object|null} settings - GSettings proxy or null
   * @returns {Promise<ProviderResult>}
   */
  async fetch(_settings) {
    return makeResult({
      id: this.id,
      label: this.label,
      icon: this.icon,
      status: ProviderStatus.UNCONFIGURED,
      error: 'Provider fetch() not implemented',
    });
  }
}
