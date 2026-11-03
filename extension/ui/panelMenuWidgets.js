import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {orientationFor} from './meterModel.js';
import {providerMeters} from './meterWidgets.js';

// Do not emit the standard activate signal: GNOME closes the entire popup
// when a menu item emits it, including items used only for navigation.
export const NavigationItem = GObject.registerClass({GTypeName: 'AIUsageBarNavigationItem'},
class NavigationItem extends PopupMenu.PopupMenuItem {
  _init(label, navigate) {
    super._init(label);
    this._navigate = navigate;
  }

  activate() { this._navigate(); }
});

export const PersistentSwitch = GObject.registerClass({GTypeName: 'AIUsageBarPersistentSwitch'},
class PersistentSwitch extends PopupMenu.PopupSwitchMenuItem {
  activate() { this.toggle(); }
});

export function previewComponent(row, result, choice, settings, path) {
  row._aiPreview?.destroy();
  const preview = new St.BoxLayout({style_class: 'ai-component-preview',
    y_align: Clutter.ActorAlign.CENTER});
  const orientation = orientationFor(choice.id, settings.get_strv('panel-orientations'),
    settings.get_string('meter-orientation'));
  preview.add_child(providerMeters(result, settings.get_string('meter-style'), path,
    settings.get_boolean('white-icons'), {
      icon: choice.kind === 'icon', activity: choice.kind === 'activity',
      meters: choice.kind === 'meter' ? [{name: choice.name, orientation}] : [],
    }));
  row.insert_child_at_index(preview, 1);
  row._aiPreview = preview;
}
