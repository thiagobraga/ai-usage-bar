import {componentChoices} from './panelComponents.js';

// Sections stay in the main popup; no native submenu or overlay is used for Components.
export function buildPanelMenu(menu, results, settings, PopupMenu, widgets, actions) {
  let alive = true;
  let expanded = false;
  let providerId = null;
  let request = 0;
  let activeResult = null;
  const previewRows = new Map();
  const section = new PopupMenu.PopupMenuSection();
  const header = new widgets.NavigationItem('Components', () => {
    expanded = !expanded;
    providerId = null;
    request++;
    actions.release();
    showProviders();
  });
  menu.addMenuItem(header);
  menu.addMenuItem(section);

  const add = (label, action) => section.addMenuItem(new widgets.NavigationItem(label, action));

  const showProviders = (selected = null, result = null, loading = false) => {
    if (!alive) return;
    section.removeAll();
    previewRows.clear();
    activeResult = result;
    if (!expanded) return;
    if (!results.length) {
      section.addMenuItem(new PopupMenu.PopupMenuItem('Enable providers in Settings',
        {reactive: false}));
      return;
    }
    for (const provider of results) {
      const open = selected === provider.id;
      add(`${provider.label} ${open ? '⌄' : '›'}`, () => {
        if (providerId === provider.id) {
          providerId = null;
          request++;
          actions.release();
          showProviders();
        } else {
          providerId = provider.id;
          const current = ++request;
          actions.release(provider.id);
          showProviders(provider.id, null, true);
          Promise.resolve().then(() => actions.load(provider.id)).then(loaded => {
            if (alive && expanded && providerId === provider.id && current === request)
              showProviders(provider.id, loaded ?? provider);
          }).catch(() => {
            if (alive && providerId === provider.id && current === request)
              showProviders(provider.id, provider);
          });
        }
      });
      if (open && result) showChoices(result);
      if (open && loading) section.addMenuItem(new PopupMenu.PopupMenuItem('Loading preview…',
        {reactive: false}));
    }
  };

  const showChoices = result => {
    if (result.id === 'opencode-openai' && result.errorKind === 'unsupported-auth') {
      section.addMenuItem(new PopupMenu.PopupMenuItem('Quota unavailable: token-sharing sign-in',
        {reactive: false}));
      section.addMenuItem(new PopupMenu.PopupMenuItem('Use ChatGPT OAuth in OpenCode',
        {reactive: false}));
    }
    for (const choice of componentChoices(result)) {
      const selected = settings.get_strv('panel-components').includes(choice.id);
      const toggle = new widgets.PersistentSwitch(choice.label, selected);
      toggle.connect('toggled', (_item, state) => actions.setComponent(choice.id, state));
      section.addMenuItem(toggle);
      actions.preview(toggle, result, choice);
      previewRows.set(choice.id, {row: toggle, choice});
      if (choice.kind !== 'meter') continue;
      const orientation = () => {
        const overrides = settings.get_strv('panel-orientations');
        return overrides.includes(`${choice.id}=vertical`) ? 'vertical'
          : overrides.includes(`${choice.id}=horizontal`) ? 'horizontal'
            : settings.get_string('meter-orientation');
      };
      const row = new widgets.NavigationItem(`Orientation: ${orientation() === 'vertical' ? 'Vertical' : 'Horizontal'}`, () => {
        const next = orientation() === 'vertical' ? 'horizontal' : 'vertical';
        actions.setOrientation(choice.id, next);
        row.label.text = `Orientation: ${next === 'vertical' ? 'Vertical' : 'Horizontal'}`;
        actions.updatePreview(toggle, activeResult ?? result, choice);
      });
      section.addMenuItem(row);
    }
  };

  const more = new PopupMenu.PopupSubMenuMenuItem('More');
  more.menu.addAction('Refresh usage', actions.refresh);
  more.menu.addAction('Settings…', actions.settings);
  menu.addMenuItem(more);

  const cleanup = () => {
    alive = false;
    request++;
    previewRows.clear();
    activeResult = null;
    menu.removeAll();
  };
  cleanup.update = result => {
    if (!alive || !activeResult || providerId !== result.id) return;
    activeResult = result;
    for (const {row, choice} of previewRows.values()) actions.updatePreview(row, result, choice);
  };
  return cleanup;
}
