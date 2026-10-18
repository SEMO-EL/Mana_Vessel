#!/usr/bin/env bash
# Run a built HTML from file:// in headless Chrome (throwaway profile) and print
# the JSON the game writes into <pre id="__report"> when the URL has ?test.
# usage: tools/chrome-test.sh <html> [query] [virtual-ms]
set -uo pipefail
HTML="$(cygpath -m "$(realpath "$1")")"          # C:/Users/... (mixed form: forward slashes)
Q="${2:-test=1}"; MS="${3:-25000}"
PROF="$(cygpath -w "$TMP")\mv-chrome-profile"
timeout 900 "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --user-data-dir="$PROF" \
  --use-angle=swiftshader --enable-unsafe-swiftshader --no-first-run --no-default-browser-check \
  --virtual-time-budget="$MS" --window-size=1280,720 --dump-dom "file:///$HTML?$Q" 2>/dev/null > "$TMP/dom.html"
grep -o '<title>[^<]*</title>' "$TMP/dom.html"
# (the report <pre> carries a style attribute; unescape &quot; &lt; &gt; &amp; — the last one last)
grep -o '<pre id="__report"[^>]*>[^<]*</pre>' "$TMP/dom.html" | sed 's/<[^>]*>//g; s/&quot;/"/g; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g'
grep -o 'id="bootMsg">[^<]*<' "$TMP/dom.html" | head -1
