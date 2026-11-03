/**
 * Provider registry for AI Usage Bar.
 *
 * Holds all registered providers and exposes helpers to filter by the
 * `enabled-providers` GSettings key and refresh them concurrently with
 * per-provider error isolation.
 */

import {ProviderStatus, makeResult} from './provider.js';
import {debugLog} from './debug.js';

const PROVIDER_TIMEOUT_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 120000;
const TRANSIENT_ERRORS = new Set(['rate-limited', 'unavailable', 'timeout']);

export class ProviderRegistry {
  constructor() {
    /** @type {Map<string, import('./provider.js').BaseProvider>} */
    this._providers = new Map();

    /** @type {Map<string, import('./provider.js').ProviderResult>} */
    this._cache = new Map();
    /** @type {Map<string, number>} provider id → epoch ms until which background refresh is skipped */
    this._backoffUntil = new Map();
    this._destroyed = false;
  }

  /**
   * Register a provider instance.
   * @param {import('./provider.js').BaseProvider} provider
   */
  register(provider) {
    this._providers.set(provider.id, provider);
  }

  unregister(id) {
    this._providers.get(id)?.destroy?.();
    this._providers.delete(id);
    this._cache.delete(id);
    this._backoffUntil.delete(id);
  }

  /**
   * Return all registered providers.
   * @returns {import('./provider.js').BaseProvider[]}
   */
  getAll() {
    return [...this._providers.values()];
  }

  /**
   * Return a single provider by id.
   * @param {string} id
   * @returns {import('./provider.js').BaseProvider|undefined}
   */
  get(id) {
    return this._providers.get(id);
  }

  /**
   * Return providers whose id is in the `enabled-providers` GSettings value.
   * @param {object} settings - GSettings proxy with get_strv('enabled-providers')
   * @returns {import('./provider.js').BaseProvider[]}
   */
  getEnabled(settings) {
    const enabledIds = settings?.get_strv('enabled-providers') ?? [];
    return enabledIds
      .map(id => this._providers.get(id))
      .filter(Boolean);
  }

  /**
   * Return the most recent cached result for a provider id.
   * @param {string} id
   * @returns {import('./provider.js').ProviderResult|null}
   */
  getCached(id) {
    return this._cache.get(id) ?? null;
  }

  /**
   * Return all cached results for the enabled provider set.
   * @param {object} settings
   * @returns {import('./provider.js').ProviderResult[]}
   */
  getCachedEnabled(settings) {
    const enabledIds = settings?.get_strv('enabled-providers') ?? [];
    return enabledIds
      .map(id => this._cache.get(id))
      .filter(Boolean);
  }

  /**
   * Refresh all enabled providers concurrently.  Each provider gets its own
   * timeout; a failing provider does not block others.
   *
   * @param {object} settings - GSettings proxy
   * @returns {Promise<Map<string, import('./provider.js').ProviderResult>>}
   */
  async refreshAll(settings, ids = null, onResult = null) {
    const enabled = this.getEnabled(settings).filter(provider => !ids || ids.includes(provider.id));
    // Store each result as soon as its provider finishes so a slow provider
    // never delays the others; onResult lets the caller update the UI per provider.
    await Promise.all(enabled.map(async provider => {
      if (this._backedOff(provider)) return;
      let result;
      try { result = await this._fetchWithTimeout(provider, settings); }
      catch (err) { result = this._failure(provider, err); }
      if (this._destroyed || this._providers.get(provider.id) !== provider) return;
      this._store(provider, result);
      try { onResult?.(provider.id); }
      catch (err) { console.warn(`[ai-usage-bar] ${provider.id}: onResult failed: ${err?.message ?? err}`); }
    }));
    if (this._destroyed) return new Map();

    return new Map(this._cache);
  }

  _backedOff(provider) {
    return (this._backoffUntil.get(provider.id) ?? 0) > Date.now();
  }

  /**
   * Cache a result.  A transient failure keeps the last good reading, marked
   * stale, so one flaky request does not blank the UI.  Rate limiting also
   * pauses background refreshes for that provider.
   * @private
   */
  _store(provider, result) {
    if (this._destroyed || this._providers.get(provider.id) !== provider) return;
    // Keyed on errorKind, not status: Codex reports a 429 as STALE via its local fallback.
    if (result.errorKind === 'rate-limited') {
      this._backoffUntil.set(provider.id, Date.now() + RATE_LIMIT_BACKOFF_MS);
    } else if (result.status !== ProviderStatus.ERROR && !result.errorKind) {
      this._backoffUntil.delete(provider.id);
    }
    if (result.status === ProviderStatus.ERROR) {
      console.warn(`[ai-usage-bar] ${provider.id}: ${result.errorKind ?? 'error'}: ${result.error ?? ''}${result.errorDetail ? ` (${result.errorDetail})` : ''}`);
      const previous = this._cache.get(provider.id);
      if (TRANSIENT_ERRORS.has(result.errorKind) && previous?.sessions?.length &&
          [ProviderStatus.OK, ProviderStatus.STALE].includes(previous.status)) {
        this._cache.set(provider.id, {...previous, status: ProviderStatus.STALE,
          errorKind: result.errorKind, error: result.error});
        return;
      }
    }
    this._cache.set(provider.id, result);
  }

  /**
   * Build an error result for a rejected fetch.  Only the registry's own
   * timeout is labeled 'timeout'; anything else is a real failure ('error',
   * not transient) so the cause stays visible instead of looking like a stall.
   * @private
   */
  _failure(provider, err) {
    return makeResult({
      id: provider.id,
      label: provider.label,
      icon: provider.icon,
      status: ProviderStatus.ERROR,
      errorKind: err?.errorKind ?? 'error',
      error: err?.message ?? 'Unknown error',
      lastUpdated: new Date(),
    });
  }

  /**
   * Refresh a single provider by id.
   * @param {string} id
   * @param {object} settings
   * @returns {Promise<import('./provider.js').ProviderResult>}
   */
  async refreshOne(id, settings) {
    const provider = this._providers.get(id);
    if (!provider) {
      return makeResult({id, status: ProviderStatus.ERROR, error: 'Provider not found'});
    }
    try {
      this._backoffUntil.delete(id);
      this._store(provider, await this._fetchWithTimeout(provider, settings));
    } catch (err) {
      this._store(provider, this._failure(provider, err));
    }
    return this._providers.get(id) === provider ? this._cache.get(id) : null;
  }

  /**
   * Wrap a provider fetch in a timeout.
   * @private
   */
  async _fetchWithTimeout(provider, settings) {
    if (!provider.isConfigured) {
      return makeResult({
        id: provider.id,
        label: provider.label,
        icon: provider.icon,
        status: ProviderStatus.UNCONFIGURED,
        lastUpdated: new Date(),
      });
    }

    const started = Date.now();
    debugLog('registry', provider.id, 'fetch start');
    const timeoutMs = provider.timeoutMs ?? PROVIDER_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(Object.assign(new Error(`Provider ${provider.id} timed out after ${timeoutMs}ms`),
            {errorKind: 'timeout'}));
        }
      }, timeoutMs);

      provider.fetch(settings)
        .then(result => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            debugLog('registry', provider.id, 'fetch done in', Date.now() - started, 'ms status', result?.status);
            resolve(result);
          }
        })
        .catch(err => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            debugLog('registry', provider.id, 'fetch threw after', Date.now() - started, 'ms', err?.message);
            reject(err);
          }
        });
    });
  }

  /**
   * Clear all cached results.
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Destroy all state.
   */
  destroy() {
    this._destroyed = true;
    for (const provider of this._providers.values()) provider.destroy?.();
    this._providers.clear();
    this._cache.clear();
    this._backoffUntil.clear();
  }
}
