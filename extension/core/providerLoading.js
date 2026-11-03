export const PROVIDERS = [
  {id: 'claude', label: 'Claude', load: () => import('../providers/claude/claude.js')},
  {id: 'codex', label: 'Codex', load: () => import('../providers/codex/codex.js')},
  {id: 'antigravity', label: 'Antigravity', load: () => import('../providers/antigravity/antigravity.js')},
  {id: 'opencode', label: 'OpenCode', prefsTitle: 'OpenCode activity', load: () => import('../providers/opencode/opencode.js')},
  {id: 'opencode-openai', label: 'OpenCode · OpenAI', prefsTitle: 'OpenCode · OpenAI quota', load: () => import('../providers/opencode/opencodeOpenAI.js')},
];

export function visibleProviderIds(settings) {
  const selected = settings.get_strv('panel-components');
  return settings.get_strv('enabled-providers').filter(id =>
    selected.some(component => component.startsWith(`${id}:`)));
}

export class ProviderLoading {
  constructor(registry, load) {
    this._registry = registry;
    this._load = load;
    this._pending = new Map();
    this._destroyed = false;
  }

  ensure(id) {
    if (this._destroyed) return Promise.resolve(null);
    if (this._registry.get(id)) return Promise.resolve(this._registry.get(id));
    if (this._pending.has(id)) return this._pending.get(id).promise;
    const token = {};
    token.promise = Promise.resolve().then(() => {
      if (this._destroyed || this._pending.get(id) !== token) return null;
      return this._load(id);
    }).then(provider => {
      if (!provider) return null;
      if (this._destroyed || this._pending.get(id) !== token) {
        provider.destroy?.();
        return null;
      }
      this._registry.register(provider);
      return provider;
    }).finally(() => {
      if (this._pending.get(id) === token) this._pending.delete(id);
    });
    this._pending.set(id, token);
    return token.promise;
  }

  release(id) {
    this._pending.delete(id);
    this._registry.unregister(id);
  }

  sync(ids) {
    const wanted = new Set(ids);
    for (const provider of this._registry.getAll()) {
      if (!wanted.has(provider.id)) this.release(provider.id);
    }
    for (const id of this._pending.keys()) {
      if (!wanted.has(id)) this.release(id);
    }
  }

  destroy() {
    this._destroyed = true;
    this._pending.clear();
    this._registry.destroy();
  }
}
