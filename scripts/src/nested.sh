#!/usr/bin/env bash
# Nested GNOME Shell action. Source this file; do not run directly.

launch_nested() {
  echo "[nested] starting nested GNOME Shell — extension auto-enabled, logs appear here"
  # Nested window size (WIDTHxHEIGHT) — mutter reads this for the dummy monitor.
  if [[ -n "${NESTED_SIZE:-}" ]]; then
    export MUTTER_DEBUG_DUMMY_MODE_SPECS="$NESTED_SIZE"
    echo "[nested] window size: $NESTED_SIZE"
  fi
  echo ""
  # gsettings runs inside the same dbus-run-session, so it targets the nested
  # session's isolated dconf — not the main session.
  exec dbus-run-session -- bash -c '
    gsettings set org.gnome.shell enabled-extensions "[\"'"$UUID"'\"]" 2>/dev/null || true
    exec gnome-shell --nested --wayland
  ' 2>&1
}
