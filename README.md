# AI Usage Bar

GNOME Shell 46 extension showing Claude and Codex subscription usage together in the top panel.

## Meters

- **Colored bars:** green session usage, amber weekly usage.
- **Unicode bars:** five segments per window (`■■···`), rounded to the nearest 20%.
- **Orientation:** automatic matches the references (colored vertical, Unicode horizontal), or explicitly horizontal/vertical. Vertical Unicode uses three segments to fit the panel.
- Session is left/top; weekly is right/bottom. These show **percent used**, not remaining.
- `—` means unavailable, including an expired reset window. Actual 0% shows an empty track/dots.
- `~` marks stale observations. Exact percentages, source, and observation time appear in the basic menu.
- Refresh defaults to 60 seconds; configurable from 30–3600 seconds. Zero disables automatic refresh.

Click to refresh, open Claude Desktop, open Claude/Codex on the web, or open settings. A detailed usage dashboard is deferred to the next version. The native GNOME menu follows your theme, including its transparency.

## Authentication and trusted data

The extension reuses existing CLI sign-ins. It does not ask for an API key, refresh/overwrite credentials, read browser cookies, or infer subscription quota from token totals.

| Provider | Local source | Authoritative usage |
| --- | --- | --- |
| Claude | `~/.claude/.credentials.json` (`CLAUDE_CONFIG_DIR` supported) | `https://api.anthropic.com/api/oauth/usage` |
| Codex | `~/.codex/auth.json` (`CODEX_HOME` supported) | `https://chatgpt.com/backend-api/wham/usage` |

Requests use HTTPS and send each token only to its own provider. Redirects are rejected. Credentials stay out of settings, command arguments, and logs. Expired sign-ins require signing in again with the corresponding CLI. Keyring-only credentials and API-key-only accounts are not supported in this version.

If Codex live usage is unavailable, a bounded asynchronous scan of local session JSONL files can show the latest quota observation. It is always marked stale because local logs cannot prove the current account identity; the menu warns that it may belong to a previous login. The scan does not guarantee finding every historical record. Claude token/activity caches do not contain subscription quota and are not used as percentage estimates.

Requests and file reads share a four-second deadline per provider. Polling is near real time, not a push stream; provider-side updates can lag. Observations older than five minutes are marked stale, and elapsed reset windows show unavailable until a fresh reading arrives.

These authenticated usage routes are provider implementation details and may change. Missing/malformed responses produce unavailable meters rather than fabricated 0%. Only the five-hour session and seven-day weekly windows are shown.

## Install and develop

Requirements: GNOME Shell 46, GJS, libsoup 3, `glib-compile-schemas`, `gnome-extensions`, and Node.js 20+ for tests.

```bash
./scripts/install.sh              # install
./scripts/install.sh -w -n        # watch in a nested GNOME session
./scripts/install.sh -p           # package
npm test                         # parser, meter, registry and metadata tests
```

After installing changed JavaScript, restart the Shell on X11 or log out/in on Wayland. Recompiling schemas and installing is handled by the script. See [scripts/README.md](scripts/README.md).

Appearance is configured through **Settings → Panel meters**. Both providers are enabled by default. Legacy appearance/API-key schema keys remain for compatibility but are not exposed or used by this version.

## Code

- `extension/extension.js`: panel lifecycle, basic menu, refresh and stale display.
- `extension/meterWidgets.js` and `meterModel.js`: native Shell widgets and pure display rules.
- `extension/providers/claude.js`, `codex.js`: authenticated usage readers.
- `extension/providers/usageData.js`, `usageIO.js`: actual quota parsers and bounded/cancellable I/O.
- `extension/prefs.js`, `schemas/`: appearance, providers and refresh preferences.
- `test/`: Node tests import production parsers and display rules.
- `site/`: separate website, unchanged by the meter work.

The older Gemini/Cursor/OpenRouter modules remain on disk but are not registered or shown in this release. Bundled brand icon sources are listed in [extension/icons/README.md](extension/icons/README.md).
