<p align="center">
  <img src=".github/assets/ai-usage-bar-transparent.png" width="250" alt="AI Usage Bar GNOME extension logo" />
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

Click the panel indicator to see usage for each enabled provider. On quota cards the center shows the percentage of the five-hour limit used. The outer ring tracks five-hour usage and the inner ring tracks weekly usage. OpenCode activity shows its seven-day token count.

When the indicator is on the right side of the top bar, the popup aligns to its right edge and grows leftward.

Expand a provider row to see its limits and reset times. Select any combination of component previews to show them together in the top bar. The switch beside the provider name turns the whole provider off or on and remembers its component choices. Use **Settings → Panel meters** for default appearance. OpenCode is one provider: its row shows 7-day token activity and, when OpenCode is signed in to ChatGPT, the OpenAI 5-hour and weekly quota of the active account.

Antigravity lists every public model quota returned by `fetchAvailableModels` in its expanded row, plus the 5-hour and weekly groups returned by `retrieveUserQuotaSummary`. Model quotas have their own reset times but no declared window, so they are not used to invent missing group readings. A group absent from the API remains unavailable even if the CLI displays it. If every Antigravity reading shows `-`, check the provider menu for a sign-in error and run `agy` to refresh an expired CLI token.

[Provider overview](docs/screens/dropdown-overview.png)

| Expanded provider | Dark theme | Light theme |
| --- | --- | --- |
| Desktop | [Screenshot](docs/screens/dropdown-desktop-dark.png) | [Screenshot](docs/screens/dropdown-desktop-light.png) |
| 390px | [Screenshot](docs/screens/dropdown-390-dark.png) | [Screenshot](docs/screens/dropdown-390-light.png) |

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
