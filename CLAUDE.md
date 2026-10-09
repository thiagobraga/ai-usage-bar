# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run tests
npm test

# Install extension to ~/.local/share/gnome-shell/extensions/ai-usage-bar@local
./scripts/install.sh

# Reload after changes (X11 only)
# On Wayland: log out/in or use nested session

# Nested GNOME Shell for testing without logout (Wayland)
dbus-run-session -- gnome-shell --nested --wayland

# Watch extension logs
journalctl --user -f -o cat | grep -i ai-usage

# Package for GNOME Extensions upload
./scripts/install.sh -p

# Uninstall
./scripts/install.sh -u
```

Run a single test file: `node --test test/provider.test.js`

## Architecture

GNOME Shell extension — all `extension/` code runs inside the Shell process as ES modules using GJS. No bundler, no transpilation. `gi://` imports are GNOME introspection bindings available only at runtime inside GNOME Shell.

```
extension.js           — Entry point (AIUsageBarExtension). Panel button, popup menu, refresh loop.
provider.js            — BaseProvider abstract class + ProviderResult shape + ProviderStatus/AuthSource enums.
providerRegistry.js    — ProviderRegistry: registers providers, caches results, refreshAll() with per-provider timeout (5s) and error isolation.
providers/             — One file per AI provider. Each extends BaseProvider and implements fetch(settings) → ProviderResult.
prefs.js               — GtkWidget-based settings UI (runs in separate process via gnome-extensions prefs).
schemas/               — GSettings schema. Must be compiled with glib-compile-schemas after changes.
stylesheet.css         — All CSS for panel + popup; GNOME Shell CSS, not browser CSS.
```

### Data flow

1. `enable()` registers providers, starts refresh loop (`refresh-interval-seconds` GSettings key).
2. `_doRefresh()` → `ProviderRegistry.refreshAll(settings)` — fetches all enabled providers concurrently. Results stored in `_cache`.
3. `_updatePanel()` reads cache → updates panel icon/text/meter.
4. `_buildMenu()` reads cache → rebuilds popup from scratch on every refresh or settings change.
5. Provider switcher tiles in popup call `this._selectedProviderId = id` then `_buildMenu()`.

### Adding a provider

1. Create `extension/providers/<name>.js` extending `BaseProvider`.
2. Override `id`, `label`, `icon`, `capabilities`, `authSource`, and `async fetch(settings)`.
3. `fetch()` must never throw — return `makeResult({status: ProviderStatus.ERROR, error: ...})` on failure.
4. Import and register in `extension.js` `enable()`.
5. Add fixture to `test/fixtures/` and parser tests to `test/provider.test.js`.

### GSettings schema

Key provider settings: `enabled-providers` (strv), `openrouter-api-key` (string), `popup-opacity` (int 35–100), `refresh-interval-seconds` (int), `compact-mode` (bool), `merge-icons` (bool).

After editing the schema XML, run `glib-compile-schemas extension/schemas/` then reinstall.

## Testing

Tests run in Node.js (not inside GNOME Shell). They test parser logic extracted inline in `test/provider.test.js` and file existence checks. Provider `fetch()` methods cannot be tested without GJS/GI — test the parser functions directly instead (see existing pattern in `provider.test.js`).

Fixture JSON files in `test/fixtures/` define the expected shape each provider parser must handle.

## Key constraints

- All extension code must be valid ES modules loadable by GJS (GNOME JavaScript engine). No Node.js built-ins (`fs`, `path`, etc.) in `extension/`.
- `Gio`, `GLib`, `St`, `Clutter` etc. come from `gi://` — only available at GNOME Shell runtime.
- `prefs.js` runs in a separate GTK process — cannot import `extension.js` or use Shell-only APIs.
- Schema changes require recompiling (`glib-compile-schemas`) and reinstalling before they take effect.
