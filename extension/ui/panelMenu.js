export function providerNotice(result) {
  if (result.id === 'opencode' && result.quotaError === 'unsupported-auth')
    return 'Token-sharing sign-in cannot report quota. Use ChatGPT OAuth in OpenCode.';
  if (result.id === 'antigravity' && ['error', 'unconfigured'].includes(result.status)) {
    if (['expired', 'auth-error', 'missing'].includes(result.errorKind))
      return 'Sign in with agy to refresh usage';
    if (result.errorKind === 'locked') return 'Unlock the GNOME keyring';
  }
  return '';
}

export function buildPanelMenu(menu, results, settings, widgets, actions) {
  const readings = new Map(results.map(result => [result.id, result]));
  let open = null;
  let alive = true;
  const view = widgets.createDashboard(menu, settings, {...actions, expand(id) {
    if (!alive) return;
    open = open === id ? null : id;
    sync();
  }});
  function sync() {
    if (!alive) return;
    const enabled = new Set(settings.get_strv('enabled-providers'));
    view.cards([...readings.values()].filter(result => enabled.has(result.id)));
    for (const result of readings.values())
      view.row(result, enabled.has(result.id), open === result.id, providerNotice(result));
  }
  sync();
  const cleanup = () => {
    alive = false;
    view.destroy();
  };
  cleanup.sync = sync;
  cleanup.update = result => cleanup.updateAll([result]);
  cleanup.updateAll = results => {
    if (!alive) return;
    for (const result of results)
      if (readings.has(result.id)) readings.set(result.id, result);
    sync();
  };
  return cleanup;
}
