#!/usr/bin/env bash
# usage: lh.sh <label> <url>
export PATH=$(ls -d ~/.hermes/tools/node-*/bin | head -1):$PATH
export CHROME_PATH=$(ls ~/.hermes/tools/chromium-1208/chrome-linux64/chrome)
B=~/.hermes/profiles/dev/cache/scratch/bp
~/.local/bin/heavy -m 1800M -- npx --yes lighthouse@12 "$2" --quiet --output=json --output-path=$B/lh.$1.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" --only-categories=performance,seo,accessibility,best-practices >/dev/null 2>$B/lh.$1.err
python3 -I $B/lhsum.py $B/lh.$1.json $1
