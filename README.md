<p align="center">
  <img src=".github/assets/ai-usage-bar.png" alt="AI Usage Bar" width="250" />
</p>

<h1 align="center">AI Usage Bar</h1>

GNOME extension that shows Claude, Codex, Antigravity and OpenCode usage together in the top panel.

## Install

Requirements: GNOME Shell 46, GJS, libsoup 3, `glib-compile-schemas`, `gnome-extensions`, and Node.js 20+ for tests. OpenCode V2 quota also requires `sqlite3`.

```bash
./scripts/install.sh              # install
./scripts/install.sh -w -n        # watch in a nested GNOME session
./scripts/install.sh -p           # package
npm test                         # parser, meter, registry and metadata tests
```

After installing changed JavaScript, restart the Shell on X11 or log out/in on Wayland. Recompiling schemas and installing is handled by the script. See [scripts/README.md](scripts/README.md).

Default meter style, orientation and icons are configured through **Settings → Panel meters**; individual visibility and orientation are controlled from the panel menu. Claude, Codex, and Antigravity are enabled by default; OpenCode activity and OpenCode OpenAI quota are separate opt-in switches.

## Code

- `extension/extension.js`: panel lifecycle, component menu, refresh and stale display.
- `extension/core/`: provider contract, registry (cache, timeout, backoff), lazy provider loading, usage age and debug logging.
- `extension/ui/`: native Shell widgets (`meterWidgets.js`, `panelMenu*.js`) and pure display rules (`meterModel.js`, `panelComponents.js`).
- `extension/providers/<name>/`: one folder per provider (`claude`, `codex`, `antigravity`, `opencode`): authenticated usage and local activity readers.
- `extension/providers/shared/`: `usageData.js` quota parsers and `usageIO.js` bounded/cancellable I/O.
- `extension/prefs.js`, `schemas/`: appearance, providers and refresh preferences.
- `extension/**/*.test.js`: Node tests sit beside the modules they cover; `extension/providers/fixtures/` holds sample responses. Install and package scripts exclude both tests and fixtures.
- `site/`: separate website, unchanged by the meter work.

Bundled brand icon sources are listed in [extension/icons/README.md](extension/icons/README.md).
