#!/usr/bin/env bash
# Log streaming action. Source this file; do not run directly.

stream_logs() {
  echo "[logs] streaming gnome-shell logs..."
  exec journalctl -f _COMM=gnome-shell 2>/dev/null \
    | grep --line-buffered -i "codex\|$UUID\|js ERROR\|js LOG"
}
