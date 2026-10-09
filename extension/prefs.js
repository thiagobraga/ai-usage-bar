import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AIUsageBarPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage({title: 'AI Usage Bar', icon_name: 'preferences-system-symbolic'});
    const display = new Adw.PreferencesGroup({title: 'Panel meters',
      description: 'Session first, weekly second. Colored bars use green for session and amber for weekly. — means unavailable; ~ means stale.'});
    for (const [key, title, labels, values] of [
      ['meter-style', 'Style', ['Colored bars', 'Unicode bars'], ['colored', 'unicode']],
      ['meter-orientation', 'Orientation', ['Automatic (matches style)', 'Horizontal', 'Vertical'], ['auto', 'horizontal', 'vertical']],
    ]) {
      const row = new Adw.ComboRow({title, model: Gtk.StringList.new(labels)});
      row.selected = Math.max(0, values.indexOf(settings.get_string(key)));
      row.connect('notify::selected', () => settings.set_string(key, values[row.selected]));
      const id = settings.connect(`changed::${key}`, () => {
        row.selected = Math.max(0, values.indexOf(settings.get_string(key)));
      });
      window.connect('close-request', () => { settings.disconnect(id); return false; });
      display.add(row);
    }
    page.add(display);
    const providers = new Adw.PreferencesGroup({title: 'Providers',
      description: 'Uses existing Claude Code and Codex sign-ins. No separate API key needed.'});
    for (const [id, title] of [['claude', 'Claude'], ['codex', 'Codex']]) {
      const row = new Adw.SwitchRow({title, active: settings.get_strv('enabled-providers').includes(id)});
      row.connect('notify::active', () => {
        const current = settings.get_strv('enabled-providers').filter(value => value !== id);
        if (row.active) current.push(id);
        settings.set_strv('enabled-providers', current);
      });
      const changed = settings.connect('changed::enabled-providers', () => {
        row.active = settings.get_strv('enabled-providers').includes(id);
      });
      window.connect('close-request', () => { settings.disconnect(changed); return false; });
      providers.add(row);
    }
    page.add(providers);
    const refresh = new Adw.PreferencesGroup({title: 'Refresh',
      description: 'Updates while the extension is enabled. Provider values may arrive with a delay; observations older than five minutes are marked stale.'});
    const interval = new Adw.SpinRow({title: 'Interval (seconds)',
      subtitle: '0 = manual only; otherwise at least 30 seconds',
      adjustment: new Gtk.Adjustment({lower: 0, upper: 3600, step_increment: 30, page_increment: 60})});
    settings.bind('refresh-interval-seconds', interval, 'value', Gio.SettingsBindFlags.DEFAULT);
    refresh.add(interval);
    page.add(refresh);
    const privacy = new Adw.PreferencesGroup({title: 'Data sources',
      description: 'Credentials are read locally and sent only to their provider over HTTPS. They are never stored in extension settings or logs.'});
    privacy.add(new Adw.ActionRow({title: 'Claude',
      subtitle: 'Claude Code credentials → api.anthropic.com. Token counts are not treated as subscription quota.'}));
    privacy.add(new Adw.ActionRow({title: 'Codex',
      subtitle: 'Codex credentials → chatgpt.com. Local session quota snapshots are a fallback and show their observation time.'}));
    privacy.add(new Adw.ActionRow({title: 'Authentication',
      subtitle: 'If your session expires, sign in again with the corresponding CLI. The extension does not change your credentials.'}));
    page.add(privacy);
    window.add(page);
  }
}
