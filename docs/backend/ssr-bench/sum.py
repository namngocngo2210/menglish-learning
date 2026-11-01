import sys, re, collections
mx = collections.defaultdict(float); cpu = collections.defaultdict(list)
for l in open(sys.argv[1]):
    p = l.split()
    if len(p) < 5: continue
    v = float(re.sub('[A-Za-z]', '', p[1])); u = 'GiB' in p[1]
    mx[p[0]] = max(mx[p[0]], v * 1024 if u else v); cpu[p[0]].append(float(p[4].strip('%')))
print(' '.join('%s_peakMiB=%.0f %s_cpuAvg=%.0f%%' % (k, v, k, sum(cpu[k]) / len(cpu[k])) for k, v in mx.items()))
