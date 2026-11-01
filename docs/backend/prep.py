import json, glob, os, sys
base = sys.argv[1]; out = sys.argv[2]
rows = []
# order matters: quarantine first (all statuses forced to quarantine), then published bundles override
for f in sorted(glob.glob(base + '/quarantine/*.json')):
    rows.append(('q', os.path.basename(f), json.load(open(f))))
for f in sorted(glob.glob(base + '/tests/*.json')):
    rows.append(('p', os.path.basename(f), json.load(open(f))))
with open(out, 'w') as o:
    for i, (layer, name, doc) in enumerate(rows):
        s = json.dumps(doc, ensure_ascii=False, separators=(',', ':'))
        s = s.replace('\\', '\\\\')
        o.write('%d\t%s\t%s\t%s\n' % (i, layer, name, s))
print(len(rows), 'files')
