import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPanelMenu} from './panelMenu.js';

class Menu {
  constructor() { this.items = []; }
  addMenuItem(item) { this.items.push(item); item.parent = this; }
  removeAll() { this.items = []; }
  addAction(label, callback) {
    const item = new Item(label);
    item.connect('activate', callback);
    this.addMenuItem(item);
  }
}
class Item {
  constructor(label) { this.label = {text: label}; this.handlers = new Map(); }
  connect(signal, callback) { this.handlers.set(signal, callback); }
  activate() { this.handlers.get('activate')?.(); }
  setOrnament(ornament) { this.ornament = ornament; }
}
class Switch extends Item {
  constructor(label, state) { super(label); this.state = state; }
  toggle() { this.state = !this.state; this.handlers.get('toggled')?.(this, this.state); }
}
class SubMenu extends Item { constructor(label) { super(label); this.menu = new Menu(); } }
class NavigationItem extends Item {
  constructor(label, navigate) { super(label); this.navigate = navigate; }
  activate() { this.navigate(); }
}
class PersistentSwitch extends Switch { activate() { this.toggle(); } }
const popup = {PopupMenuItem: Item, PopupSwitchMenuItem: Switch,
  PopupSubMenuMenuItem: SubMenu, PopupMenuSection: Menu, Ornament: {DOT: 'dot', NONE: 'none'}};
const names = menu => menu.items.filter(item => item.label).map(item => item.label.text);
const click = (menu, label) => {
  const item = menu.items.find(row => row.label?.text === label);
  assert.ok(item, `Missing ${label} in ${names(menu)}`);
  item.activate();
};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('Components expands inline; only the opened provider renders previews', async () => {
  const menu = new Menu();
  const values = {'panel-components': ['claude:icon', 'claude:Session'], 'panel-orientations': []};
  const settings = {get_strv: key => [...values[key]], get_string: () => 'horizontal'};
  const loaded = [];
  const previewed = [];
  const updated = [];
  const cleanup = buildPanelMenu(menu, [
    {id: 'claude', label: 'Claude', sessions: []},
    {id: 'codex', label: 'Codex', sessions: []},
  ], settings, popup, {NavigationItem, PersistentSwitch}, {
    load: async id => { loaded.push(id); return {id, label: id, sessions: []}; },
    preview: (row, result, choice) => previewed.push([result.id, choice.id]),
    updatePreview: (row, result, choice) => updated.push([result.id, choice.id]),
    setComponent: (id, enabled) => {
      values['panel-components'] = values['panel-components'].filter(value => value !== id);
      if (enabled) values['panel-components'].push(id);
    },
    setOrientation: () => {}, refresh: () => {}, settings: () => {},
    release: () => {},
  });
  assert.deepEqual(names(menu), ['Components', 'More']);
  assert.deepEqual(loaded, []);
  click(menu, 'Components');
  const section = menu.items[1];
  assert.deepEqual(names(section), ['Claude ›', 'Codex ›']);
  assert.deepEqual(previewed, []);
  click(section, 'Claude ›');
  await flush();
  assert.deepEqual(loaded, ['claude']);
  assert.deepEqual(names(section).slice(0, 5), ['Claude ⌄', 'Icon', 'Session', 'Orientation: Horizontal', 'Weekly']);
  assert.deepEqual(previewed.map(([, id]) => id), ['claude:icon', 'claude:Session', 'claude:Weekly']);
  cleanup.update({id: 'claude', label: 'Claude', sessions: [{name: 'Session', usedPercent: 37}]});
  assert.deepEqual(updated.map(([, id]) => id), ['claude:icon', 'claude:Session', 'claude:Weekly']);
  click(section, 'Session');
  assert.equal(values['panel-components'].includes('claude:Session'), false);
  click(section, 'Codex ›');
  await flush();
  assert.deepEqual(loaded, ['claude', 'codex']);
  assert.deepEqual(previewed.filter(([id]) => id === 'codex').length, 3);
  cleanup();
  assert.deepEqual(menu.items, []);
});

test('late provider load cannot render after menu cleanup', async () => {
  const menu = new Menu();
  let finish;
  const previews = [];
  const cleanup = buildPanelMenu(menu, [{id: 'claude', label: 'Claude'}],
    {get_strv: () => [], get_string: () => 'horizontal'}, popup,
    {NavigationItem, PersistentSwitch}, {
      load: () => new Promise(resolve => { finish = resolve; }),
      preview: (...args) => previews.push(args), setComponent: () => {},
      setOrientation: () => {}, refresh: () => {}, settings: () => {},
      release: () => {},
    });
  click(menu, 'Components');
  click(menu.items[1], 'Claude ›');
  await Promise.resolve();
  cleanup();
  finish({id: 'claude', label: 'Claude', sessions: []});
  await flush();
  assert.deepEqual(previews, []);
  assert.deepEqual(menu.items, []);
});

console.log('panel menu tests passed');
