#!/bin/bash
# Usage: scripts/check-redirects.sh <base-url> <file-with-old-paths>
# Asserts every old path answers one 301 (query kept) to a URL that answers 200 directly (no chain, no loop).
H="${1:?base url}"; ok=0; bad=0
while read -r p; do
  [ -z "$p" ] || [ "$p" = "/" ] && continue
  out=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$H$p?utm_source=t")
  code=${out%% *}; loc=${out#* }
  if [ "$code" != 301 ]; then echo "NOT301 $p $out"; bad=$((bad+1)); continue; fi
  case "$loc" in *utm_source=t) ;; *) echo "NOQUERY $p $loc"; bad=$((bad+1)); continue;; esac
  final=$(curl -s -o /dev/null -w '%{http_code}' "$loc")
  if [ "$final" != 200 ]; then echo "FINAL$final $p -> $loc"; bad=$((bad+1)); continue; fi
  ok=$((ok+1))
done < "${2:?file}"
echo "ok=$ok bad=$bad"
[ "$bad" = 0 ]
