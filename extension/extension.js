import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {ProviderRegistry} from './providerRegistry.js';
import {makeResult} from './provider.js';
import ClaudeProvider from './providers/claude.js';
import CodexProvider from './providers/codex.js';
import {providerMeters} from './meterWidgets.js';
import {usageSummary} from './meterModel.js';
import {STALE_AFTER_MS} from './providers/usageData.js';

export default class AIUsageBarExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._registry = new ProviderRegistry();
    this._registry.register(new ClaudeProvider());
    this._registry.register(new CodexProvider());
    this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
    this._panelBox = new St.BoxLayout({style_class: 'ai-panel-box'});
    this._indicator.add_child(this._panelBox);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
    this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
      this._updatePanel();
      this._buildMenu();
      if (key === 'refresh-interval-seconds') this._startRefreshLoop();
      if (key === 'enabled-providers') this._doRefresh();
    });
    this._indicator.menu.connect('open-state-changed', (_menu, open) => {
      if (open) this._buildMenu();
    });
    this._updatePanel();
    this._buildMenu();
    this._doRefresh();
    this._startRefreshLoop();
    // Age observations even when automatic network refresh is disabled.
    this._ageTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
      this._updatePanel();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    this._stopRefreshLoop();
    if (this._ageTimer) GLib.source_remove(this._ageTimer);
    this._ageTimer = null;
    this._settings?.disconnect(this._settingsChangedId);
    this._registry?.destroy();
    this._registry = null;
    this._refreshing = null;
    this._indicator?.destroy();
    this._indicator = null;
    this._settings = null;
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

  async _doRefresh() {
    const registry = this._registry;
    if (!registry || this._refreshing === registry) return;
    this._refreshing = registry;
    try {
      await registry.refreshAll(this._settings);
      if (this._registry !== registry) return;
      this._updatePanel();
      this._buildMenu();
    } finally {
      if (this._refreshing === registry) this._refreshing = null;
    }
  }

  _results() {
    const enabled = this._settings.get_strv('enabled-providers');
    return this._registry.getAll().filter(provider => enabled.includes(provider.id)).map(provider => {
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
    for (const result of results) {
      this._panelBox.add_child(providerMeters(result, this._settings.get_string('meter-style'),
        this._settings.get_string('meter-orientation'), this.path));
    }
    if (!results.length) this._panelBox.add_child(new St.Label({text: 'AI —'}));
    this._indicator.accessible_name = results.map(result => usageSummary(result)).join('; ') || 'AI usage: no providers enabled';
  }

  _buildMenu() {
    if (!this._indicator) return;
    const menu = this._indicator.menu;
    menu.removeAll();
    // A small status/launch menu; the detailed dashboard is deferred.
    for (const result of this._results()) {
      menu.addMenuItem(new PopupMenu.PopupMenuItem(usageSummary(result), {reactive: false}));
      const updated = result.lastUpdated ? result.lastUpdated.toLocaleString() : 'never';
      const text = `${result.source || 'Provider usage'} · Updated ${updated}`;
      const detail = new PopupMenu.PopupMenuItem(text, {reactive: false});
      detail.add_style_class_name('ai-source');
      menu.addMenuItem(detail);
      if (result.error) {
        const warning = new PopupMenu.PopupMenuItem(result.error, {reactive: false});
        warning.add_style_class_name('ai-source');
        menu.addMenuItem(warning);
      }
    }
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    menu.addAction('Refresh usage', () => this._doRefresh());
    menu.addAction('Open Claude Desktop…', () => {
      try {
        const app = Gio.DesktopAppInfo.new('com.anthropic.Claude.desktop');
        if (!app) throw new Error('Claude Desktop is not installed.');
        app.launch([], global.create_app_launch_context(0, -1));
      } catch (error) {
        Main.notifyError('AI Usage Bar', error.message);
      }
    });
    menu.addAction('Open Claude on web…', () => this._openUrl('https://claude.ai'));
    menu.addAction('Open Codex on web…', () => this._openUrl('https://chatgpt.com/codex'));
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    menu.addAction('Settings…', () => this.openPreferences());
  }

  _openUrl(url) {
    Gio.AppInfo.launch_default_for_uri_async(url, global.create_app_launch_context(0, -1),
      null, (_source, result) => {
        try { Gio.AppInfo.launch_default_for_uri_finish(result); }
        catch (error) { Main.notifyError('AI Usage Bar', error.message); }
      });
  }
}
