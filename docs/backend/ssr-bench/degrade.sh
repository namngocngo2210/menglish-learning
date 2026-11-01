#!/usr/bin/env bash
B=~/.hermes/profiles/dev/cache/scratch/bp
cd $B
IP=$(HTML_TTL_MS=2000 bash web.sh bj-m-deg 0 1 384m "node proxy.cjs & exec node server.js")
A=$(sed -n 1p slugs.txt); Bs=$(sed -n 2p slugs.txt)
t() { curl -s -o /tmp/deg.out -D /tmp/deg.h -m 15 -w "%{http_code} %{time_total}s" "$1"; echo " | $(grep -i -E '^(x-cache|retry-after)' /tmp/deg.h | tr -d '\r' | tr '\n' ' ')"; }
echo "1 warm A (proxy):      $(t http://$IP:3100/$A)"
sleep 3
echo "2 DB paused..."; docker pause bj-m-pg >/dev/null
echo "3 A stale (proxy):     $(t http://$IP:3100/$A)"
echo "4 B cold (proxy):      $(t http://$IP:3100/$Bs)"; head -c 140 /tmp/deg.out; echo
sleep 3
echo "5 A again (proxy):     $(t http://$IP:3100/$A)"
echo "6 B direct to Next, no proxy/no cache: $(t http://$IP:3000/$Bs)"
docker unpause bj-m-pg >/dev/null; sleep 1
echo "7 DB back, B (proxy):  $(t http://$IP:3100/$Bs)"
echo "8 A (proxy):           $(t http://$IP:3100/$A)"
docker logs bj-m-deg 2>&1 | grep -c "pool\|ECONN\|timeout" | sed 's/^/log error lines: /'
