# Agent Instructions

`AGENTS.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks to this file. Edit only `CLAUDE.md` and never replace a symlink.

## Rules

- **Read before editing** project files when implementing features or fixing bugs. Inspect exact definitions, trace dataflows, and check all callers before changing signatures. Scope searches to relevant projects and limit log output to save tokens.
- **Keep responses short** unless more detail is requested. Use one sentence or a short list explaining what was done and anything needed to use it. Use `/caveman ultra` when available.
- **Avoid em dashes and AI slop** in all new output, including code, comments, documentation, commits, and chat. Skip pleasantries, flattery, repetition, recaps, filler, emojis, and unsolicited next steps.
- **Keep files under 1000 lines.** Before and after editing, check line counts of touched files. Split any hand-written file approaching or exceeding the limit into focused modules (Rust: `engine/` child modules per concern; CSS: `src/styles/` files per section) instead of growing it. Generated files such as `tauri-app/src-tauri/gen/schemas/` are exempt and never hand-edited.
- **Apply first-principles reasoning** before development. Understand requirements and underlying behavior, choose the simplest working solution, and write clean, readable code without premature abstractions.
- **Preserve architectural boundaries** by keeping business logic in `core/`, adapters thin, and React independent of transport-specific behavior. Maintain consistent behavior across desktop and web.
- **Write tests for every behavioral code change** following TDD rules: write a failing test, make it pass, then refactor. Add regression tests for bug fixes. Use isolated fixtures in temporary directories, never real user files.
- **Verify changes before completion** by running relevant tests, type checks, builds, and integration checks. Report failures and unverified behavior explicitly. Never claim tests passed without executing them.
- **Keep documentation updated** when changes affect `README.md`, `DESIGN.md`, `CLAUDE.md`, `.specs/`, or `docs/`. Follow canonical specifications for behavior, `0007-api.md` for API contracts, and `DESIGN.md` for visual decisions. Fix conflicting code and ask before intentionally changing the design.
- **Build accessible and responsive interfaces** using semantic components, keyboard navigation, clear feedback, consistent spacing, and `DESIGN.md` tokens. Avoid visual clutter, unnecessary nesting, and duplicated components.
- **Verify UI changes** by building and capturing affected screens in Chrome at desktop and 390px, in both light and dark themes. Update affected `docs/screens/` images and README tables.
- **Protect filesystem operations** by validating paths, permissions, symlinks, and operation boundaries. Never modify files outside explicitly configured locations. Ensure interrupted or failed operations preserve recoverability.
- **Keep backup operations safe** by revalidating comparisons before execution, handling conflicts explicitly, and retaining replaced or deleted files before destructive changes. Never silently overwrite user data.
- **Secure every interface** by validating inputs, enforcing authentication and authorization, and preventing command injection, path traversal, credential exposure, and unintended remote access.
- **Protect credentials and user data** by storing provider secrets only in the OS keyring, never in JSON, logs, exports, or application state. Treat service authentication tokens as separate sensitive credentials. Avoid destructive operations on real user files during development and testing.
- **Follow Conventional Commits** using `type(scope): summary` with lowercase imperative messages. Name branches `type/slug` and follow the same convention for PR titles.

## Commands

```bash
# Run tests
npm test

# Install extension to ~/.local/share/gnome-shell/extensions/ai-usage-bar@local
./scripts/install.sh

# Reload after changes (X11 only)
# On Wayland: log out/in or use the nested session

# Nested GNOME Shell with isolated settings (Wayland, logs in terminal)
./scripts/install.sh -w -n

# Watch extension logs
journalctl --user -f -o cat | grep -i ai-usage

# Package for GNOME Extensions upload
./scripts/install.sh -p

# Uninstall
./scripts/install.sh -u
```

Run a single test file: `node --test extension/core/provider.test.js`

## Architecture

GNOME Shell extension — all `extension/` code runs inside the Shell process as ES modules using GJS. No bundler, no transpilation. `gi://` imports are GNOME introspection bindings available only at runtime inside GNOME Shell.

```
extension.js           — Entry point (AIUsageBarExtension). Panel button, popup menu, refresh loop.
prefs.js               — Adw settings UI (runs in separate process via gnome-extensions prefs).
metadata.json, stylesheet.css, schemas/, icons/ — Required at the extension root. CSS is GNOME Shell CSS, not browser CSS. Compile schemas with glib-compile-schemas.
core/                  — Logic with no St/Clutter. provider.js (BaseProvider, ProviderResult, enums), providerRegistry.js (cache, 5s per-provider timeout, backoff, error isolation), providerLoading.js (PROVIDERS list, lazy imports), usageAge.js, debug.js.
ui/                    — Shell widgets and display rules. meterModel.js and panelComponents.js are pure (Node-testable); meterWidgets.js, panelMenu.js, panelMenuWidgets.js use St/Clutter.
providers/             — One file per AI provider, each extends BaseProvider. providers/opencode/ groups the OpenCode readers; usageData.js (parsers) and usageIO.js (bounded I/O) are shared; fixtures/ holds sample responses.
```

Tests sit beside the modules they cover (`*.test.js`); `extension/metadata.test.js` covers packaging.

### Data flow

1. `enable()` creates the registry, starts the refresh loop (`refresh-interval-seconds` GSettings key).
2. `_doRefresh()` loads visible providers via `providerLoading.js`, then `ProviderRegistry.refreshAll(settings, ids, onResult)` fetches them concurrently. Each result is cached and `onResult` updates the panel as that provider finishes.
3. `_updatePanel()` reads the cache and rebuilds the panel meters.
4. The popup menu updates per provider through `_disposeMenu.update(result)`.

### Adding a provider

1. Create `extension/providers/<name>.js` extending `BaseProvider`.
2. Override `id`, `label`, `icon`, `capabilities`, `authSource`, and `async fetch(settings)`.
3. `fetch()` must never throw — return `makeResult({status: ProviderStatus.ERROR, error: ...})` on failure.
4. Add it to `PROVIDERS` in `extension/core/providerLoading.js` and to the provider rows in `extension/prefs.js`.
5. Add fixtures to `extension/providers/fixtures/` and parser tests beside the relevant module (or `extension/core/provider.test.js` for shared contracts).

### GSettings schema

Key provider settings: `enabled-providers` (strv), `openrouter-api-key` (string), `popup-opacity` (int 35–100), `refresh-interval-seconds` (int), `compact-mode` (bool), `merge-icons` (bool).

After editing the schema XML, run `glib-compile-schemas extension/schemas/` then reinstall.

## Testing

Tests run in Node.js (not inside GNOME Shell) and live beside the modules they cover as `*.test.js`. They test parser logic and file existence checks. Provider `fetch()` methods that need GJS/GI cannot be imported directly in Node; test parsers directly or use isolated GJS fixtures. Install, sync, and package scripts exclude tests and fixtures.

Fixture JSON files in `extension/providers/fixtures/` define the expected shape each provider parser must handle.

## Key constraints

- All runtime extension code must be valid ES modules loadable by GJS (GNOME JavaScript engine). Node.js built-ins (`fs`, `path`, etc.) are allowed only in excluded `*.test.js` files.
- `Gio`, `GLib`, `St`, `Clutter` etc. come from `gi://` — only available at GNOME Shell runtime.
- `prefs.js` runs in a separate GTK process — cannot import `extension.js` or use Shell-only APIs.
- Schema changes require recompiling (`glib-compile-schemas`) and reinstalling before they take effect.

## Plan Mode - Specs Convention

All AI agents (Claude, Codex, Antigravity, OpenCode) must follow this when entering Plan mode:

1. **Create a new folder** under `.specs/` with the naming pattern: `yyyy-mm-dd-<short-kebab-case-slug>` (e.g., `2026-08-04-exact-colors`).
2. Write **`.specs/yyyy-mm-dd-slug/plan.md`** - user-focused and highly readable specification explaining WHAT the feature does from a user perspective (like a person requesting a feature), focusing on behavior, user flows, and intent rather than implementation details. Include a centralized **Relevant Files** section listing all affected files.
3. Write **`.specs/yyyy-mm-dd-slug/task.md`** - technical breakdown describing HOW it is implemented, organized into numbered tasks and nested subtasks with checkboxes (`[ ]` not started, `[~]` in progress, `[x]` completed), exact code references, file paths, and architecture/engineering details.
4. **Update `task.md`** as work progresses.

## For work under `site/`

### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
