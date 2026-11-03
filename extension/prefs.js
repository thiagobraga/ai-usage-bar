import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {PROVIDERS} from './core/providerLoading.js';

export default class AIUsageBarPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const page = new Adw.PreferencesPage({title: 'AI Usage Bar', icon_name: 'preferences-system-symbolic'});
    const display = new Adw.PreferencesGroup({title: 'Panel meters',
      description: 'Choose individual icons, quota windows and their orientation in the panel menu under Components.'});
    for (const [key, title, labels, values] of [
      ['meter-style', 'Style', ['Colored bars', 'Unicode bars'], ['colored', 'unicode']],
      ['meter-orientation', 'Default orientation', ['Horizontal', 'Vertical'], ['horizontal', 'vertical']],
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
    const whiteIcons = new Adw.SwitchRow({title: 'White provider icons',
      subtitle: 'Match system icons for Claude and Antigravity'});
    settings.bind('white-icons', whiteIcons, 'active', Gio.SettingsBindFlags.DEFAULT);
    display.add(whiteIcons);
    page.add(display);
    const providers = new Adw.PreferencesGroup({title: 'Providers',
      description: 'OpenCode shows 7-day activity and, when signed in to ChatGPT, its OpenAI quota.'});
    for (const {id, label, prefsTitle} of PROVIDERS) {
      const title = prefsTitle ?? label;
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
      description: 'Only providers shown in the panel update in the background. Observations older than five minutes are marked stale.'});
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
    privacy.add(new Adw.ActionRow({title: 'Antigravity',
      subtitle: 'Antigravity CLI sign-in from the GNOME keyring → cloudcode-pa.googleapis.com. Shows available group buckets and individual model quotas; model resets do not identify a 5-hour or weekly window. Sign in with agy if the token expires.'}));
    privacy.add(new Adw.ActionRow({title: 'OpenCode',
      subtitle: 'OpenCode CLI session statistics and connected provider names from local auth.json give 7-day tokens and cost. Its active ChatGPT OAuth sign-in (local database or legacy auth.json) is used to request OpenAI quota from chatgpt.com. Token-sharing sign-ins cannot show ChatGPT plan quota. Requires sqlite3 for OpenCode V2; credentials are not copied, shown or refreshed.'}));
    privacy.add(new Adw.ActionRow({title: 'Authentication',
      subtitle: 'If your session expires, sign in again with the corresponding CLI. The extension does not change your credentials.'}));
    page.add(privacy);
    window.add(page);
  }
}
