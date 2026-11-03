import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { setDebug } from './core/debug.js';
import { providerMeters } from './ui/meterWidgets.js';
import { buildPanelMenu } from './ui/panelMenu.js';
import * as dashboardWidgets from './ui/dashboardWidgets.js';
import { showAbout } from './ui/aboutDialog.js';
import { panelDescription, visibleComponents } from './ui/panelComponents.js';
import { makeResult } from './core/provider.js';
import { ProviderRegistry } from './core/providerRegistry.js';
import { PROVIDERS, ProviderLoading, visibleProviderIds } from './core/providerLoading.js';
import { STALE_AFTER_MS } from './core/usageAge.js';

export default class AIUsageBarExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._refreshQueued = false;
    setDebug(this._settings.get_boolean('debug-logging'));
    this._registry = new ProviderRegistry();
    this._visibleIds = new Set(visibleProviderIds(this._settings));
    this._loading = new ProviderLoading(this._registry, async id => {
      const descriptor = PROVIDERS.find(provider => provider.id === id);
      if (!descriptor) throw new Error(`Unknown provider: ${id}`);
      const module = await descriptor.load();
      return new module.default();
    });
    const isRtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
    this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
    this._indicator.menu.setSourceAlignment(isRtl ? 1.0 : 0.0);
    this._panelBox = new St.BoxLayout({style_class: 'ai-panel-box'});
    this._indicator.add_child(this._panelBox);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
      if (key === 'debug-logging') setDebug(this._settings.get_boolean('debug-logging'));
      this._updatePanel();
      if (key === 'refresh-interval-seconds') this._startRefreshLoop();
      if (['enabled-providers', 'panel-components'].includes(key)) {
        this._refreshAdded();
      }
      this._disposeMenu?.sync();
    });
    this._menuStateId = this._indicator.menu.connect('open-state-changed', (_menu, open) => {
      this._refreshAdded();
      if (open) this._updateMenuReadings();
      else this._buildMenu();
    });
    this._updatePanel();
    this._buildMenu();
    this._doRefresh();
    this._startRefreshLoop();
    // Age observations even when automatic network refresh is disabled.
    this._ageTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
      this._updatePanel();
      if (this._indicator.menu.isOpen) this._updateMenuReadings();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    this._stopRefreshLoop();
    if (this._ageTimer) GLib.source_remove(this._ageTimer);
    this._ageTimer = null;
    this._settings?.disconnect(this._settingsChangedId);
    this._indicator?.menu.disconnect(this._menuStateId);
    this._disposeMenu?.();
    this._disposeMenu = null;
    this._loading?.destroy();
    this._loading = null;
    this._registry = null;
    this._refreshing = null;
    this._refreshQueued = false;
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
    setDebug(false);
  }

  _startRefreshLoop() {
    this._stopRefreshLoop();
    const interval = this._settings.get_int('refresh-interval-seconds');
    if (interval > 0) this._refreshTimeoutId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT, Math.max(30, interval), () => {
        this._doRefresh();
        return GLib.SOURCE_CONTINUE;
      });
  }

  _stopRefreshLoop() {
    if (this._refreshTimeoutId) GLib.source_remove(this._refreshTimeoutId);
    this._refreshTimeoutId = null;
  }

  // Fetch only providers that just became visible; cosmetic toggles never hit the network.
  _refreshAdded() {
    const ids = visibleProviderIds(this._settings, this._indicator.menu.isOpen);
    this._loading.sync(ids);
    const added = ids.filter(id => !this._visibleIds.has(id));
    this._visibleIds = new Set(ids);
    if (added.length) this._doRefresh(added);
  }

  _updateMenuReadings() {
    this._disposeMenu?.updateAll(this._results(true));
  }

  async _doRefresh(only = null) {
    const registry = this._registry;
    if (!registry) return;
    if (this._refreshing === registry) {
      this._refreshQueued = true;
      return;
    }
    this._refreshing = registry;
    try {
      const ids = only ?? visibleProviderIds(this._settings, this._indicator.menu.isOpen);
      const imports = await Promise.allSettled(ids.map(id => this._loading.ensure(id)));
      for (const outcome of imports) {
        if (outcome.status === 'rejected')
          console.warn(`[ai-usage-bar] provider load failed: ${outcome.reason?.message ?? outcome.reason}`);
      }
      if (this._registry !== registry) return;
      await registry.refreshAll(this._settings, ids, id => {
        if (this._registry !== registry) return;
        this._updatePanel();
        const result = this._results().find(provider => provider.id === id);
        if (result && this._indicator.menu.isOpen) this._disposeMenu?.update(result);
      });
    } catch (error) {
      console.warn(`[ai-usage-bar] provider load failed: ${error?.message ?? error}`);
    } finally {
      if (this._refreshing === registry) {
        this._refreshing = null;
        if (this._refreshQueued) {
          this._refreshQueued = false;
          this._doRefresh();
        }
      }
    }
  }

  _results(all = false) {
    const enabled = this._settings.get_strv('enabled-providers');
    return PROVIDERS.filter(provider => all || enabled.includes(provider.id)).map(provider => {
      const cached = this._registry.getCached(provider.id);
      const result = cached ?? makeResult({id: provider.id, label: provider.label,
        error: this._refreshing ? 'Checking usage…' : 'Usage unavailable'});
      const age = result.lastUpdated ? Date.now() - result.lastUpdated.getTime() : Infinity;
      return result.status === 'ok' && age > STALE_AFTER_MS ? {...result, status: 'stale'} : result;
    });
  }

  _updatePanel() {
    if (!this._indicator) return;
    this._panelBox.destroy_all_children();
    const results = this._results();
    const visible = this._settings.get_strv('panel-components');
    const orientations = this._settings.get_strv('panel-orientations');
    const fallback = this._settings.get_string('meter-orientation');
    const descriptions = [];
    for (const result of results) {
      const display = visibleComponents(result, visible, orientations, fallback);
      if (!display.activity && !display.meters.length) continue;
      this._panelBox.add_child(providerMeters(result, this._settings.get_string('meter-style'),
        this.path, this._settings.get_boolean('white-icons'), display));
      descriptions.push(panelDescription(result, display));
    }
    // Keep the menu reachable when everything has been turned off.
    if (!descriptions.length) this._panelBox.add_child(new St.Label({text: 'AI',
      y_align: Clutter.ActorAlign.CENTER}));
    this._indicator.accessible_name = descriptions.join('; ') || 'AI usage: no panel components selected';
  }

  _setPanelComponent(id, enabled) {
    const selected = this._settings.get_strv('panel-components').filter(value => value !== id);
    if (enabled) selected.push(id);
    this._settings.set_strv('panel-components', selected);
  }

  _buildMenu() {
    if (!this._indicator) return;
    this._disposeMenu?.();
    this._disposeMenu = buildPanelMenu(this._indicator.menu, this._results(true), this._settings,
      dashboardWidgets, {
        path: this.path,
        setProvider: (id, enabled) => {
          const ids = this._settings.get_strv('enabled-providers').filter(value => value !== id);
          if (enabled) ids.push(id);
          this._settings.set_strv('enabled-providers', ids);
        },
        setComponent: (id, state) => this._setPanelComponent(id, state),
        setOrientation: (id, value) => {
          const values = this._settings.get_strv('panel-orientations')
            .filter(entry => entry !== `${id}=horizontal` && entry !== `${id}=vertical`);
          this._settings.set_strv('panel-orientations', [...values, `${id}=${value}`]);
        },
        refresh: () => this._doRefresh(),
        settings: () => this.openPreferences(),
        about: () => {
          this._indicator.menu.close();
          showAbout(this.metadata);
        },
      });
  }
}
