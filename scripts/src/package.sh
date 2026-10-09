#!/usr/bin/env bash
# Package action. Source this file; do not run directly.

do_package() {
  glib-compile-schemas "$SRC_DIR/schemas"
  local out="$ROOT_DIR/$UUID.zip"
  rm -f "$out"
  (cd "$SRC_DIR" && zip -r "$out" . -x '*.compiled' -x '__pycache__/*' -x '.git/*')
  echo "[package] → $out"
  echo "          gnome-extensions install --force '$out'"
}
