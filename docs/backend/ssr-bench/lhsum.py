import json, sys
d = json.load(open(sys.argv[1])); c = d['categories']; a = d['audits']
print(sys.argv[2], {k: round(v['score'] * 100) for k, v in c.items()},
      'LCP', a['largest-contentful-paint']['displayValue'], 'FCP', a['first-contentful-paint']['displayValue'],
      'TBT', a['total-blocking-time']['displayValue'], 'CLS', a['cumulative-layout-shift']['displayValue'],
      'TTFB(server-response-time)', a['server-response-time']['displayValue'])
