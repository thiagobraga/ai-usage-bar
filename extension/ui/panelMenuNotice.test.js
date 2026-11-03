import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPanelMenu} from './panelMenu.js';

class Menu {
  constructor() { this.items = []; }
  addMenuItem(item) { this.items.push(item); }
  removeAll() { this.items = []; }
  addAction(label) { this.addMenuItem(new Item(label)); }
}
class Item {
  constructor(label) { this.label = {text: label}; }
  connect() {}
}
class SubMenu extends Item { constructor(label) { super(label); this.menu = new Menu(); } }
class NavigationItem extends Item {
  constructor(label, navigate) { super(label); this.navigate = navigate; }
  activate() { this.navigate(); }
}
const names = menu => menu.items.map(item => item.label.text);

test('OpenCode token-sharing failure is visible in the provider menu', async () => {
  const menu = new Menu();
  const result = {id: 'opencode-openai', label: 'OpenCode · OpenAI', status: 'unconfigured',
    errorKind: 'unsupported-auth', sessions: []};
  buildPanelMenu(menu, [result], {get_strv: () => [], get_string: () => 'horizontal'},
    {PopupSubMenuMenuItem: SubMenu, PopupMenuSection: Menu, PopupMenuItem: Item},
    {NavigationItem, PersistentSwitch: Item}, {setComponent() {}, setOrientation() {},
      release() {}, load: async () => result, preview() {}, refresh() {}, settings() {}});
  menu.items[0].activate();
  const panel = menu.items[1];
  panel.items[0].activate();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(names(panel).some(label => /token.sharing/i.test(label)));
  assert.ok(names(panel).some(label => /ChatGPT.*OAuth/i.test(label)));
});
