import St from 'gi://St';
import Gio from 'gi://Gio';
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {componentChoices} from './panelComponents.js';
import {componentPreview} from './panelMenuWidgets.js';
import {orientationFor, usageSummary} from './meterModel.js';
import {buildSummaryCard, buildUsageDetails} from './usageSummaryWidgets.js';

const center = Clutter.ActorAlign.CENTER;
function column(style_class) {
  const direction = 'orientation' in St.BoxLayout.prototype
    ? {orientation: Clutter.Orientation.VERTICAL} : {vertical: true};
  return new St.BoxLayout({...direction, style_class, x_expand: true});
}
function label(text, style_class = '') {
  return new St.Label({text, style_class, y_align: center});
}
function icon(name, size = 16) {
  return new St.Icon({icon_name: name, icon_size: size, y_align: center});
}
function button(name, style_class, onClick, toggle = false) {
  const actor = new St.Button({style_class, accessible_name: name, can_focus: true,
    reactive: true, track_hover: true, toggle_mode: toggle});
  actor.connect('clicked', () => onClick(actor));
  return actor;
}
function put(scroll, content) {
  if (scroll.set_child) scroll.set_child(content);
  else scroll.add_actor(content);
}
function grid(parent, children, columns, style, pad = false) {
  for (let offset = 0; offset < children.length; offset += columns) {
    const line = new St.BoxLayout({style_class: style});
    parent.add_child(line);
    const cells = children.slice(offset, offset + columns);
    for (const child of cells) line.add_child(child);
    if (pad) {
      for (let n = cells.length; n < columns; n++)
        line.add_child(new St.Widget({x_expand: true}));
    }
  }
}

function newProviderRow(parent, result, actions) {
  const group = column('ai-provider-section');
  parent.add_child(group);
  const header = new St.BoxLayout({style_class: 'ai-provider-header'});
  group.add_child(header);
  const expand = button(result.label, 'ai-expand', () => actions.expand(result.id));
  expand.x_expand = true;
  const title = new St.BoxLayout({style_class: 'ai-provider-title', x_expand: true});
  expand.x_align = Clutter.ActorAlign.FILL;
  const brand = result.id;
  title.add_child(new St.Icon({gicon: Gio.icon_new_for_string(actions.path + '/icons/' + brand + '.svg'),
    icon_size: 20, y_align: center}));
  const name = label(result.label);
  name.x_expand = true;
  title.add_child(name);
  const arrow = icon('pan-end-symbolic', 12);
  title.add_child(arrow);
  expand.set_child(title);
  header.add_child(expand);
  const toggle = button('Enable ' + result.label, 'ai-provider-toggle',
    self => actions.setProvider(result.id, self.checked), true);
  toggle.accessible_role = Atk.Role.TOGGLE_BUTTON;
  const track = new PopupMenu.Switch(false);
  track.reactive = false;
  toggle.set_child(track);
  header.add_child(toggle);
  return {group, expand, arrow, toggle, track};
}

function makeTile(choice, result, settings, actions) {
  const cell = column('ai-choice-cell');
  const tile = button(result.label + ' ' + choice.label, 'ai-choice',
    self => actions.setComponent(choice.id, self.checked), true);
  tile.accessible_role = Atk.Role.TOGGLE_BUTTON;
  const stack = column('ai-choice-content');
  const sample = new St.Bin({x_align: center, y_align: center, style_class: 'ai-choice-sample'});
  stack.add_child(sample);
  stack.add_child(new St.Label({text: choice.label, style_class: 'ai-choice-label', x_align: center}));
  tile.set_child(stack);
  cell.add_child(tile);
  let rotate;
  const orientation = () => orientationFor(choice.id, settings.get_strv('panel-orientations'),
    settings.get_string('meter-orientation'));
  if (choice.kind === 'meter') {
    rotate = button(choice.label + ' meter orientation', 'ai-orientation', () =>
      actions.setOrientation(choice.id, orientation() === 'vertical' ? 'horizontal' : 'vertical'));
    cell.add_child(rotate);
  }
  return {cell, update(reading, selected) {
    tile.checked = selected.includes(choice.id);
    if (rotate) rotate.label = orientation() === 'vertical' ? '↕ Vertical' : '↔ Horizontal';
    sample.get_child()?.destroy();
    sample.set_child(componentPreview(reading, choice, settings, actions.path));
  }};
}

function updateBody(row, result, enabled, notice, settings, actions, columns) {
  const choices = componentChoices(result);
  const signature = JSON.stringify(choices.map(c => [c.group, c.id, c.label]));
  if (signature !== row.signature) {
    row.body?.destroy();
    row.body = column('ai-provider-body');
    row.group.add_child(row.body);
    row.signature = signature;
    row.tiles = [];
    // One even grid: single windows first, then the paired views.
    row.tiles = choices.map(choice => makeTile(choice, result, settings, actions));
    grid(row.body, row.tiles.map(tile => tile.cell), columns, 'ai-choice-line', true);
    row.details = column('ai-reading-section');
    row.body.add_child(row.details);
  }
  const selected = settings.get_strv('panel-components');
  for (const tile of row.tiles) tile.update(result, selected);
  row.details.destroy_all_children();
  if (enabled) row.details.add_child(buildUsageDetails(result));
  if (!enabled || notice) {
    const hint = label(enabled ? notice : 'Enable this provider to see usage.', 'ai-source');
    hint.clutter_text.line_wrap = true;
    row.details.add_child(hint);
  }
}

export function createDashboard(menu, settings, actions) {
  const monitor = Main.layoutManager.findMonitorForActor(menu.sourceActor) ?? Main.layoutManager.primaryMonitor;
  const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
  const width = Math.max(200, Math.min(510, monitor.width / scale - 64));
  const columns = Math.max(2, Math.floor(width / 100));
  const tileColumns = Math.min(4, columns);
  const host = new PopupMenu.PopupBaseMenuItem({activate: false, hover: false, can_focus: false});
  host.style_class = 'ai-dashboard-host';
  menu.addMenuItem(host);
  const scroll = new St.ScrollView({style: 'width: ' + width + 'px; max-height: ' +
    Math.max(150, Math.min(650, monitor.height / scale - 135)) + 'px;'});
  scroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
  host.add_child(scroll);
  const content = column('ai-dashboard');
  put(scroll, content);
  const overview = column('ai-overview');
  content.add_child(overview);
  const providers = column('ai-provider-list');
  content.add_child(providers);
  const footer = column('ai-dashboard-footer');
  content.add_child(footer);
  for (const [name, glyph, action] of [['Refresh usage', 'view-refresh-symbolic', actions.refresh],
    ['Settings', 'preferences-system-symbolic', actions.settings],
    ['About', 'help-about-symbolic', actions.about]]) {
    const control = button(name, 'ai-footer-button', action);
    control.x_expand = true;
    control.x_align = Clutter.ActorAlign.FILL;
    const caption = new St.BoxLayout({style_class: 'ai-footer-caption'});
    // 20px slot matches the provider row icons so icons and text line up.
    const slot = new St.Bin({style: 'width: 20px;', y_align: center});
    slot.set_child(icon(glyph, 16));
    caption.add_child(slot);
    caption.add_child(label(name));
    control.set_child(caption);
    footer.add_child(control);
  }

  const rows = new Map();
  let cardIds = null;
  const cards = new Map();
  return {
    cards(results) {
      const ids = results.map(r => r.id).join(',');
      if (ids !== cardIds) {
        cardIds = ids;
        overview.destroy_all_children();
        cards.clear();
        for (const result of results) {
          const card = button(result.label + ' usage details', 'ai-card-button', () => actions.expand(result.id));
          card.x_expand = true;
          cards.set(result.id, card);
        }
        grid(overview, [...cards.values()], columns, 'ai-card-line');
        if (!results.length) overview.add_child(label('Enable a provider below to see usage.', 'ai-empty'));
      }
      for (const result of results) {
        const card = cards.get(result.id);
        card.get_child()?.destroy();
        card.set_child(buildSummaryCard(result));
        card.accessible_name = usageSummary(result);
      }
    },
    row(result, enabled, expanded, notice) {
      if (!rows.has(result.id)) rows.set(result.id, newProviderRow(providers, result, actions));
      const row = rows.get(result.id);
      row.toggle.checked = enabled;
      row.track.state = enabled;
      row.arrow.icon_name = expanded ? 'pan-down-symbolic' : 'pan-end-symbolic';
      row.expand.accessible_name = (expanded ? 'Collapse ' : 'Expand ') + result.label;
      if (expanded) {
        row.group.add_style_pseudo_class('active');
        updateBody(row, result, enabled, notice, settings, actions, tileColumns);
      } else {
        row.group.remove_style_pseudo_class('active');
        row.body?.destroy();
        row.body = null;
        row.tiles = null;
        row.signature = null;
      }
    },
    destroy() { host.destroy(); },
  };
}
