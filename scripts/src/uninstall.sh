#!/usr/bin/env bash
# Uninstall action. Source this file; do not run directly.

do_uninstall() {
  gnome-extensions disable "$UUID" 2>/dev/null || true
  gnome-extensions uninstall "$UUID" 2>/dev/null || rm -rf "$DEST_DIR"
  echo "[uninstall] removed $UUID"
}
