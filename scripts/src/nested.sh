#!/usr/bin/env bash
# Nested GNOME Shell action. Source this file; do not run directly.

# Extensions enabled in the nested session alongside the one under test
# (space-separated UUIDs). Not installed → skipped with a warning.
#   NESTED_EXTENSIONS="dash-to-panel@jderose9.github.com Vitals@CoreCoding.com" ./scripts/install.sh -n
NESTED_EXTENSIONS="${NESTED_EXTENSIONS:-dash-to-panel@jderose9.github.com}"

# Session mode for the nested shell. "user" skips the Ubuntu session mode,
# which force-enables ding (desktop icons), ubuntu-dock, appindicators and
# tiling-assistant - they fight dash-to-panel. Set NESTED_MODE=ubuntu to
# preview with them instead.
NESTED_MODE="${NESTED_MODE:-user}"

# The nested session gets its own dconf database so that enabling extensions
# or changing settings inside it never touches the main session. The profile
# lives here; the database itself is ~/.config/dconf/ai_usage_bar_nested and is
# rebuilt from these seeds on every launch. (dconf requires the db name to be a
# valid D-Bus path element - keep underscores, never dots or dashes.)
NESTED_DCONF_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ai-usage-bar/nested-dconf"

# Build a fresh isolated database: the main session's extension preferences
# plus an enabled list of the extension under test + NESTED_EXTENSIONS.
nested_prepare_dconf() {
  local profile="$NESTED_DCONF_DIR/profile"
  local uuid dir found list prefs
  local enabled=()

  mkdir -p "$NESTED_DCONF_DIR"
  printf 'user-db:ai_usage_bar_nested\n' > "$profile"

  for uuid in "$UUID" $NESTED_EXTENSIONS; do
    [[ " ${enabled[*]} " == *" $uuid "* ]] && continue
    found=false
    for dir in \
      "$HOME/.local/share/gnome-shell/extensions" \
      /usr/share/gnome-shell/extensions; do
      [[ -d "$dir/$uuid" ]] && found=true
    done
    if $found; then
      enabled+=("$uuid")
    else
      echo "[nested] warning: extension not installed, skipping: $uuid" >&2
    fi
  done

  list=""
  for uuid in "${enabled[@]}"; do list+="'$uuid', "; done

  # Rebuild the nested db through dconf itself. Never delete or edit the db
  # files directly: running dconf services cache the database in memory and
  # would clobber external edits (dconf reset is the supported way to clear).
  DCONF_PROFILE="$profile" dconf reset -f /org/gnome/shell/ 2>/dev/null || true
  DCONF_PROFILE="$profile" dconf write /org/gnome/shell/enabled-extensions "[${list%, }]"

  # Mirror main-session extension prefs: API keys, dash-to-panel layout, ...
  if ! prefs="$(dconf dump /org/gnome/shell/extensions/ 2>/dev/null)"; then
    echo "[nested] warning: could not read main-session prefs; using defaults" >&2
    prefs=""
  fi
  DCONF_PROFILE="$profile" dconf load /org/gnome/shell/extensions/ <<<"$prefs"

  echo "[nested] enabled: ${enabled[*]}"
}

# Toggle the extension inside the running nested session (via the private bus
# address recorded at launch) so gnome-shell reloads it from disk. Used by
# watch mode. Returns non-zero when no nested session is reachable.
nested_reload_extension() {
  local bus_file="$NESTED_DCONF_DIR/bus-address" address
  [[ -f "$bus_file" ]] || return 1
  address="$(<"$bus_file")"
  DBUS_SESSION_BUS_ADDRESS="$address" DCONF_PROFILE="$NESTED_DCONF_DIR/profile" \
    gnome-extensions info "$UUID" >/dev/null 2>&1 || return 1
  DBUS_SESSION_BUS_ADDRESS="$address" DCONF_PROFILE="$NESTED_DCONF_DIR/profile" bash -c '
    gnome-extensions disable "'"$UUID"'" 2>/dev/null || true
    sleep 0.5
    gnome-extensions enable "'"$UUID"'" 2>/dev/null || true
  '
  return 0
}

launch_nested() {
  echo "[nested] starting nested GNOME Shell - logs appear here"
  # Nested window size (WIDTHxHEIGHT) - mutter reads this for the dummy monitor.
  if [[ -n "${NESTED_SIZE:-}" ]]; then
    export MUTTER_DEBUG_DUMMY_MODE_SPECS="$NESTED_SIZE"
    echo "[nested] window size: $NESTED_SIZE"
  fi
  echo ""
  nested_prepare_dconf
  # Record the private bus address so watch mode can reach this session's
  # gnome-shell, then hand the terminal over to the shell.
  export DCONF_PROFILE="$NESTED_DCONF_DIR/profile"
  exec dbus-run-session -- bash -c '
    printf "%s\n" "$DBUS_SESSION_BUS_ADDRESS" > "'"$NESTED_DCONF_DIR"'/bus-address"
    exec gnome-shell --nested --wayland --mode="'"$NESTED_MODE"'"
  ' 2>&1
}
