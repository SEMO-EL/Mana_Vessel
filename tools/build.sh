#!/usr/bin/env bash
# Builds the single-file game:  ../mana-vessel-3d.html  (next to the project folder)
#
# Layout of the output:
#   <style>            src/ui/style.css (+ embedded fonts)
#   <body>             src/ui/dom.html
#   x-mv-module        three.js + addons, base64, relative imports rewritten to
#                      bare "three/addons/..." specifiers so an import map can
#                      resolve them from blob: URLs
#   x-mv-asset         models / textures / fonts, base64
#   window.ART         the 15 painted images, spliced verbatim from v2
#   x-mv-game          the game: every src/*.js concatenated into ONE module
#   loader             classic script: blob URLs -> import map -> import(game)
#
# No Node/Python here, so this is plain bash + coreutils.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../mana-vessel-3d.html}"
V2="$ROOT/../mana-vessel-v2.html"
B="$ROOT/build"; mkdir -p "$B"

b64() { base64 -w0 "$1"; }

# ---------- vendor modules ----------
vendor_block() {
  local spec="$1" file="$2" dir="$3"
  local tmp="$B/mod.js"
  if [ -n "$dir" ]; then
    # './X.js' -> 'three/addons/<dir>/X.js' ; '../X/Y.js' -> 'three/addons/X/Y.js'
    sed -E "s#from '\./#from 'three/addons/$dir/#g; s#from '\.\./#from 'three/addons/#g" "$file" > "$tmp"
  else
    cp "$file" "$tmp"
  fi
  if grep -qE "from '\.{1,2}/" "$tmp"; then echo "unresolved relative import in $file" >&2; exit 1; fi
  printf '<script type="application/x-mv-module" data-spec="%s">%s</script>\n' "$spec" "$(b64 "$tmp")"
}

# ---------- assets ----------
asset_block() {  # name file
  printf '<script type="application/x-mv-asset" data-name="%s">%s</script>\n' "$1" "$(b64 "$2")"
}

# ---------- game source ----------
GAME="$B/game.js"; : > "$GAME"; : > "$B/linemap.txt"
line=1
for f in "$ROOT"/src/*.js; do
  n=$(wc -l < "$f")
  printf '%6d  %s\n' "$line" "$(basename "$f")" >> "$B/linemap.txt"
  cat "$f" >> "$GAME"; printf '\n' >> "$GAME"
  line=$((line + n + 1))
done
if grep -q '</script' "$GAME"; then echo "src contains </script — escape it" >&2; exit 1; fi

{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  echo '<title>Mana Vessel — The Borderlands of Fittoa</title>'
  echo '<style>'
  cat "$ROOT/src/ui/style.css"
  echo '</style></head><body>'
  cat "$ROOT/src/ui/dom.html"

  vendor_block three "$ROOT/vendor/three/three.module.min.js" ""
  for f in $(cd "$ROOT/vendor/three/addons" && find . -name '*.js' | sed 's#^\./##' | sort); do
    vendor_block "three/addons/$f" "$ROOT/vendor/three/addons/$f" "$(dirname "$f")"
  done

  for f in "$ROOT"/assets/models/*.glb;   do asset_block "models/$(basename "$f")"   "$f"; done
  for f in "$ROOT"/assets/textures/*.png; do asset_block "textures/$(basename "$f")" "$f"; done
  if ls "$ROOT"/assets/fonts/*.woff2 >/dev/null 2>&1; then
    for f in "$ROOT"/assets/fonts/*.woff2; do asset_block "fonts/$(basename "$f")" "$f"; done
  fi

  # painted art from v2, verbatim (never re-encoded)
  echo '<script>window.ART = {'
  if [ -f "$V2" ]; then
    awk '/^const ART = \{$/{f=1;next} /^\};$/{if(f){f=0}} f' "$V2"
  fi
  echo '};</script>'

  printf '<script type="application/x-mv-game">\n'
  cat "$GAME"
  printf '</script>\n'

  cat "$ROOT/src/ui/loader.html"
  echo '</body></html>'
} > "$OUT"

echo "built $OUT  ($(wc -c < "$OUT") bytes, game $(wc -l < "$GAME") lines)"
