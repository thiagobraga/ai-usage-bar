#!/usr/bin/env bash
# Shared vars and dependency checks. Source this file; do not run directly.

UUID="ai-usage-bar@local"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC_DIR="$ROOT_DIR/extension"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
ZIP_FILE="$ROOT_DIR/$UUID.zip"

check_deps() {
  local watch="${1:-false}"
  local nested="${2:-false}"

  for cmd in gnome-extensions glib-compile-schemas; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "error: $cmd not found" >&2; exit 1; }
  done
  "$watch" && ! command -v inotifywait >/dev/null 2>&1 \
    && { echo "error: inotifywait not found (install inotify-tools)" >&2; exit 1; }
  "$nested" && ! command -v dbus-run-session >/dev/null 2>&1 \
    && { echo "error: dbus-run-session not found" >&2; exit 1; }
  return 0
}
