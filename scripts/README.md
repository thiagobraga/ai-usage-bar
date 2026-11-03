# scripts/

All dev tooling for AI Usage Bar lives in `install.sh`. Run it from the project root.

## Usage

```bash
./scripts/install.sh [flags]
```

| Flag | Long | What it does |
|------|------|--------------|
| | | Install once (default, no flags) |
| `-w` | `--watch` | Watch `extension/` for changes, reinstall automatically |
| `-n` | `--nested` | Launch a nested GNOME Shell window with isolated settings - extension logs stream to this terminal |
| `-s WxH` | `--size WxH` | Nested window size, e.g. `-n -s 1800x800` (sets `MUTTER_DEBUG_DUMMY_MODE_SPECS`) |
| `-l` | `--logs` | Stream GNOME Shell logs (main session only) |
| `-u` | `--uninstall` | Disable and remove the extension |
| `-p` | `--package` | Build a distributable zip for GNOME Extensions upload |
| `-t` | `--tests` | Run the Node.js test suite |

## Common workflows

**Install and forget:**
```bash
./scripts/install.sh
```

**Active development on Wayland (recommended):**
```bash
./scripts/install.sh -w -n
```
Watches `extension/` for changes and opens a nested GNOME Shell window, logs streaming to
the same terminal. The extension (plus dash-to-panel) is auto-enabled; every file change is
synced and the extension is reloaded inside the nested session.

**Active development on X11:**
```bash
./scripts/install.sh -w     # auto-toggles extension on each save
```

**Watch + stream logs (main session / X11):**
```bash
./scripts/install.sh -w -l
```

**Package for upload:**
```bash
./scripts/install.sh -p
# Produces ai-usage-bar@local.zip in the project root
```

## Nested session behavior (`-n`)

The nested shell runs with **isolated settings**: it uses its own dconf database
(`~/.config/dconf/ai_usage_bar_nested`, profile in `~/.local/state/ai-usage-bar/nested-dconf/`)
that is re-seeded from the main session's extension preferences on every launch. Enabling
extensions or changing prefs inside the nested session never touches the main session.

- **Enabled extensions** - `ai-usage-bar@local` plus `$NESTED_EXTENSIONS` (default:
  `dash-to-panel@jderose9.github.com`). UUIDs that are not installed are skipped with a warning.
- **Session mode** - `$NESTED_MODE` (default: `user`). The Ubuntu session mode
  (`ubuntu`) force-enables ding (desktop icons), ubuntu-dock, appindicators and
  tiling-assistant, which fight dash-to-panel; `user` skips them.
- **Watch reload** - with `-w -n`, changed files are synced and the extension is
  disabled/enabled inside the nested session over its private bus (address recorded in
  `~/.local/state/ai-usage-bar/nested-dconf/bus-address`).

## Architecture

`install.sh` is a thin dispatcher. All action logic lives in `src/`:

| File | Functions |
|------|-----------|
| `src/common.sh` | `check_deps` - shared vars (`UUID`, `ROOT_DIR`, `DEST_DIR`, `ZIP_FILE`) |
| `install.sh` | `do_install` (zip → gnome-extensions CLI), `do_sync` (rsync for nested mode) |
| `src/uninstall.sh` | `do_uninstall` |
| `src/package.sh` | `do_package` |
| `src/tests.sh` | `do_tests` |
| `src/watch.sh` | `watch_loop` - re-syncs on change; reloads inside the nested session |
| `src/nested.sh` | `nested_prepare_dconf`, `nested_reload_extension`, `launch_nested` |
| `src/logs.sh` | `stream_logs` |

`install.sh` sources all `src/` files at startup, then calls the right functions based on flags.

### Why nested mode uses rsync instead of reinstall

`do_install` uses `gnome-extensions install --force`, which wipes and recreates the extension directory. While the nested gnome-shell has those files open this causes errors. `do_sync` uses `rsync --delete` instead, which updates files in-place without removing the directory.

## TODO - community lib/plugin

This script solves a problem every GNOME extension developer hits: there is no standard dev toolchain. Future work:

- [ ] Extract `src/` into a standalone `gnome-ext-dev` shell library installable via a package manager or curl
- [ ] Publish as a template / cookiecutter for new GNOME extensions
- [ ] Add `--hot` flag: detect Wayland vs X11 automatically and pick the right reload strategy
- [ ] Add `--prefs` flag to open the preferences dialog after install
- [ ] Investigate `gdbus` calls to reload extensions without disable/enable toggle (avoids the 0.5s sleep)
