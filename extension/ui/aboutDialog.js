import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

function line(text, styleClass) {
  const actor = new St.Label({text, style_class: styleClass, x_align: Clutter.ActorAlign.CENTER});
  actor.clutter_text.line_wrap = true;
  return actor;
}

export function showAbout(metadata) {
  const dialog = new ModalDialog.ModalDialog({destroyOnClose: true});
  const body = new St.BoxLayout({vertical: true, style_class: 'ai-about-body'});
  body.add_child(line(metadata.name, 'ai-about-title'));
  body.add_child(line('Version ' + (metadata['version-name'] ?? metadata.version), 'ai-summary-caption'));
  body.add_child(line(metadata.description, ''));
  dialog.contentLayout.add_child(body);
  dialog.setButtons([
    {label: 'Close', key: Clutter.KEY_Escape, action: () => dialog.close()},
    {label: 'Source code', default: true, action: () => {
      Gio.AppInfo.launch_default_for_uri(metadata.url, null);
      dialog.close();
    }},
  ]);
  dialog.open();
}
