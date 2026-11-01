#!/usr/bin/env bash
# usage: scen.sh <label> <web_container> <conc> <secs> [port]  (slugs.txt as paths)
B=~/.hermes/profiles/dev/cache/scratch/bp
export PATH=$(ls -d ~/.hermes/tools/node-*/bin | head -1):$PATH
IP=$(docker inspect -f '{{(index .NetworkSettings.Networks "bj-m-net").IPAddress}}' "$2")
PATHS=$(sed 's#^#/#' $B/slugs.txt | paste -sd,)
( for i in $(seq 1 $(( $4 + 2 ))); do docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' bj-m-pg "$2" 2>/dev/null; done ) > $B/stats.$1.txt &
SP=$!
OUT=$(node $B/load.js $IP ${5:-3000} $3 $4 "$PATHS")
wait $SP 2>/dev/null
echo "$1 $OUT"
python3 -I $B/sum.py $B/stats.$1.txt
