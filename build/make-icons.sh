#!/bin/bash
# Regenerate the PNG icons from the SVGs. macOS only (qlmanage + sips);
# on other systems use any SVG rasterizer to produce 512px PNGs named
# icon.svg.png / icon-stage.svg.png in a temp dir and run the sips lines.
set -euo pipefail
ICONS="$(cd "$(dirname "$0")/../public/icons" && pwd)"
TMP="$(mktemp -d)"

qlmanage -t -s 512 -o "$TMP" "$ICONS/icon.svg" "$ICONS/icon-stage.svg" >/dev/null 2>&1

emit() {   # emit <source png> <dest dir>
  local src="$1" dest="$2"
  mkdir -p "$dest"
  cp "$src" "$dest/icon-512.png"
  sips -z 192 192 "$src" --out "$dest/icon-192.png" >/dev/null
  sips -z 180 180 "$src" --out "$dest/apple-touch-icon.png" >/dev/null
}
emit "$TMP/icon.svg.png" "$ICONS"
emit "$TMP/icon-stage.svg.png" "$ICONS/stage"
rm -rf "$TMP"
ls -la "$ICONS" "$ICONS/stage"
