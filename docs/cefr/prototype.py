"""CEFR estimation PROTOTYPE (throwaway, docs only - not feature code). See ../cefr-levels.md.
Run: CEFR_WORK=<dir with data/cefrj-vocab-1.5.csv + data/en_50k.txt> CEFR_SRC=web/content/tests/ python3 -I prototype.py
The licensed word lists are NOT committed; download them as described in the doc. Reads the bank read-only; writes under $CEFR_WORK/out.
"""
import csv, json, glob, re, random, statistics, collections, os, math, sys
BASE = os.environ.get('CEFR_WORK', '/tmp/cefr-work')
SRC = os.environ.get('CEFR_SRC', 'web/content/tests/')
OUT = BASE + '/out'; os.makedirs(OUT, exist_ok=True)
LV = ['Pre-A1', 'A1', 'A2', 'B1', 'B2']

# ---------- resources ----------
cefrj = {}  # word -> min level number (A1=1..B2=4)
for r in csv.DictReader(open(BASE + '/data/cefrj-vocab-1.5.csv', encoding='utf-8')):
    lvl = {'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4}.get(r['CEFR'].strip())
    if not lvl: continue
    for w in re.split(r'[/]', r['headword'].lower()):
        w = re.sub(r'[^a-z\' -]', '', w).strip()
        if not w or ' ' in w: continue
        cefrj[w] = min(cefrj.get(w, 9), lvl)
rank = {}
for i, line in enumerate(open(BASE + '/data/en_50k.txt', encoding='utf-8')):
    w = line.split()[0]
    rank.setdefault(w, i + 1)
IRREG = dict(was='be', were='be', are='be', am='be', been='be', being='be', had='have', has='have', did='do', does='do', done='do', went='go', gone='go', goes='go', came='come', saw='see', seen='see', ate='eat', eaten='eat', took='take', taken='take', gave='give', given='give', made='make', wrote='write', written='write', ran='run', began='begin', begun='begin', broke='break', broken='break', brought='bring', bought='buy', caught='catch', chose='choose', chosen='choose', drew='draw', drawn='draw', drove='drive', driven='drive', fell='fall', fallen='fall', felt='feel', found='find', flew='fly', flown='fly', forgot='forget', got='get', grew='grow', grown='grow', heard='hear', held='hold', kept='keep', knew='know', known='know', left='leave', lost='lose', met='meet', paid='pay', rode='ride', rose='rise', said='say', sat='sit', sent='send', slept='sleep', sold='sell', spoke='speak', spent='spend', stood='stand', taught='teach', told='tell', thought='think', understood='understand', wore='wear', won='win', built='build', became='become', children='child', men='man', women='woman', people='person', better='good', best='good', worse='bad', worst='bad', more='much', most='much', its='it', my='i', your='you', his='he', her='she', our='we', their='they', me='i', him='he', us='we', them='they')
def lemma_candidates(w):
    if w in IRREG: yield IRREG[w]
    yield w
    if w.endswith('ies'): yield w[:-3] + 'y'
    if w.endswith('es'): yield w[:-2]
    if w.endswith('s'): yield w[:-1]
    if w.endswith('ied'): yield w[:-3] + 'y'
    if w.endswith('ed'): yield w[:-2]; yield w[:-1]
    if w.endswith('ed') and len(w) > 4 and w[-3] == w[-4]: yield w[:-3]
    if w.endswith('ing'): yield w[:-3]; yield w[:-3] + 'e'
    if w.endswith('ing') and len(w) > 5 and w[-4] == w[-5]: yield w[:-4]
    if w.endswith('ly'): yield w[:-2]
    if w.endswith('ier') or w.endswith('iest'): yield w.rsplit('i', 1)[0] + 'y'
    if w.endswith('er'): yield w[:-2]; yield w[:-1]
    if w.endswith('est'): yield w[:-3]; yield w[:-2]
    if w.endswith('ness'): yield w[:-4]
    if w.endswith('ment'): yield w[:-4]
    if w.endswith('ers'): yield w[:-3]
def word_level(w):
    """-> (level 1..4 as float, source)"""
    for c in lemma_candidates(w):
        if c in cefrj: return float(cefrj[c]), 'cefrj'
    r = rank.get(w)
    if r is None:
        for c in lemma_candidates(w):
            if c in rank: r = rank[c]; break
    if r is None: return 4.0, 'unk'
    if r <= 2000: return 2.0, 'freq'
    if r <= 5000: return 3.0, 'freq'
    return 4.0, 'freq'
def freq_level(w):  # independent method: frequency only, no CEFR-J
    r = rank.get(w)
    if r is None:
        for c in lemma_candidates(w):
            if c in rank: r = rank[c]; break
    if r is None: return 4.0
    return 1.0 if r <= 1000 else 2.0 if r <= 2500 else 3.0 if r <= 6000 else 4.0
STOP = set('a an the and or but of to in on at for from with by is are am was were be been being do does did have has had it its this that these those i you he she we they me him her us them my your his our their not no yes there here what who whom whose which when where why how as if than then so too very can will would could should may might must shall'.split())
def tokens(text):
    out = []
    for m in re.finditer(r"[A-Za-z]+(?:'[a-z]+)?", text):
        w = m.group(0); start = m.start()
        prev = text[:start].rstrip()
        sentence_start = (not prev) or prev[-1] in '.?!:\n"“'
        if w[0].isupper() and not sentence_start and w != 'I': continue  # proper-noun heuristic
        out.append(re.sub(r"'(s|re|ve|ll|d|t|m)$", '', w.lower()))
    return out
def pctl(xs, p):
    if not xs: return 0.0
    xs = sorted(xs); k = (len(xs) - 1) * p; f = math.floor(k); c = math.ceil(k)
    return xs[f] + (xs[c] - xs[f]) * (k - f)
def lex(text):
    ws = [w for w in tokens(text) if w not in STOP and len(w) > 1]
    if not ws: return dict(p90=1.0, mean=1.0, n=0, hard=[], levels=[])
    lv = [(w,) + word_level(w) for w in ws]
    levels = [l for _, l, _ in lv]
    return dict(p90=pctl(levels, .9), mean=statistics.mean(levels), n=len(ws), hard=sorted({w for w, l, _ in lv if l >= 3})[:6], levels=levels)
def lex_freq(text):
    ws = [w for w in tokens(text) if w not in STOP and len(w) > 1]
    return pctl([freq_level(w) for w in ws], .9) if ws else 1.0
def syll(w):
    w = w.lower(); n = len(re.findall(r'[aeiouy]+', w))
    if w.endswith('e') and not w.endswith(('le', 'ee')) and n > 1: n -= 1
    return max(1, n)
def sentences(text):
    return [s for s in re.split(r'(?<=[.!?])\s+|\n+', text) if re.search(r'[A-Za-z]', s)]
def avg_sent_len(text):
    ss = sentences(text); return statistics.mean(len(re.findall(r"[A-Za-z]+", s)) for s in ss) if ss else 0
def fk_grade(text):
    ss = sentences(text); ws = re.findall(r"[A-Za-z]+", text)
    if not ss or not ws: return 0
    return 0.39 * len(ws) / len(ss) + 11.8 * sum(syll(w) for w in ws) / len(ws) - 15.59
def interp(x, pts):  # piecewise linear (x,y) clamp
    if x <= pts[0][0]: return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1: return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]
SENT_PTS = [(4, 0.5), (7, 1), (11, 2), (16, 3), (22, 4)]       # words/sentence -> 0..4
FK_PTS = [(2, 0.5), (4, 1), (6, 2), (8, 3), (11, 4)]           # FK grade -> 0..4
GRAM_BAND = {'grammar-be': 1, 'grammar-possessive': 1, 'grammar-article': 1, 'grammar-preposition': 1.5, 'grammar-question': 1.5, 'grammar-present-continuous': 1.5, 'grammar-present-marker': 1, 'grammar-do-base': 1.5, 'grammar-past-marker': 1.5, 'grammar-to-infinitive': 1.5, 'grammar-comparison': 2, 'grammar-will': 2, 'grammar-past-continuous': 2, 'grammar-present-perfect': 2, 'grammar-passive': 2.5, 'grammar-conditional': 3, 'grammar-past-perfect': 3, 'grammar-modal': 2}
TOPIC_RULE = {'dong-tu-to-be': 'grammar-be', 'tinh-tu-so-huu': 'grammar-possessive', 'mao-tu': 'grammar-article', 'gioi-tu': 'grammar-preposition', 'cau-hoi': 'grammar-question', 'thi-hien-tai-tiep-dien': 'grammar-present-continuous', 'thi-hien-tai-don': 'grammar-present-marker', 'thi-qua-khu-don': 'grammar-past-marker', 'dong-tu-nguyen-mau-co-to': 'grammar-to-infinitive', 'so-sanh': 'grammar-comparison', 'thi-tuong-lai-don': 'grammar-will', 'thi-qua-khu-tiep-dien': 'grammar-past-continuous', 'thi-hien-tai-hoan-thanh': 'grammar-present-perfect', 'cau-bi-dong': 'grammar-passive', 'cau-dieu-kien': 'grammar-conditional', 'thi-qua-khu-hoan-thanh': 'grammar-past-perfect', 'dong-tu-khuyet-thieu': 'grammar-modal'}
MODAL_LV = {'can': 1.0, 'will': 2.0, 'should': 2.0, 'would': 2.0, 'must': 3.0, 'could': 3.0, 'may': 3.0, 'might': 3.0}

def fill(stem, ans):
    return re.sub(r'_{2,}', ans, stem, count=1) if re.search(r'_{2,}', stem) else stem + ' ' + ans
def item_score(q, passage_scores):
    opts = {o['key']: o['text'] for o in q['options']}; ans = opts[q['correctKey']]
    stem = q['stem']; full = fill(stem, ans)   # distractors NEVER used
    L = lex(full); parts = {}; skill = q['skill']
    sent = interp(avg_sent_len(full), SENT_PTS)
    if skill == 'tu-vung':
        tw = [word_level(w)[0] for w in tokens(ans) if w not in STOP] or [L['p90']]
        target = max(tw)
        parts = dict(target=(target, .45), lex=(L['p90'], .30), sent=(sent, .25))
    elif skill == 'ngu-phap':
        rule = TOPIC_RULE.get(q['topicSlug'])
        g = GRAM_BAND.get(rule)
        if rule == 'grammar-modal':
            m = [MODAL_LV[w] for w in tokens(full) if w in MODAL_LV]
            g = max(m) if m else 2.0
        if g is None: parts = dict(lex=(L['p90'], .60), sent=(sent, .40))
        else: parts = dict(gram=(g, .40), lex=(L['p90'], .35), sent=(sent, .25))
    elif skill == 'doc-hieu':
        ps = passage_scores.get(q.get('passageId'))
        qlex = L['p90']; qsent = sent
        if ps is None: parts = dict(lex=(qlex, .6), sent=(qsent, .4))
        else: parts = dict(passage=(ps, .50), lex=(qlex, .30), sent=(qsent, .20))
    else:
        parts = dict(lex=(L['p90'], .6), sent=(sent, .4))
    S = sum(v * w for v, w in parts.values()) / sum(w for _, w in parts.values())
    return S, parts, L, full
def passage_score(p):
    body = p['body']; L = lex(body)
    fk = interp(fk_grade(body), FK_PTS); sl = interp(avg_sent_len(body), SENT_PTS)
    rare = sum(1 for l in L['levels'] if l >= 3) / max(1, len(L['levels']))
    rare_s = interp(rare, [(0.03, 1), (0.08, 2), (0.15, 3), (0.25, 4)])
    S = .35 * rare_s + .25 * fk + .25 * sl + .15 * L['p90']
    return S
CUTS = [0.95, 1.65, 2.35, 3.05]   # Pre-A1 < .95 <= A1 < 1.65 <= A2 < 2.35 <= B1 < 3.05 <= B2
def to_level(S):
    i = sum(S >= c for c in CUTS); return i
def confidence(S, parts):
    d = min(abs(S - c) for c in CUTS)  # distance to nearest threshold
    vals = [v for v, _ in parts.values()]
    spread = max(vals) - min(vals) if len(vals) > 1 else 0
    c = min(1.0, d / 0.35) * (1 - min(0.5, spread / 6))
    if S > 3.6: c *= 0.7   # beyond the B2 cap
    return round(c, 2)

def main():
    items = []; passages = {}
    for f in sorted(glob.glob(SRC + 'bank-grade-*.json')):
        d = json.load(open(f))
        for p in d['passages']: passages[p['id']] = p
        for q in d['questions']: items.append(q)
    pscore = {pid: passage_score(p) for pid, p in passages.items()}
    rows = []
    for q in items:
        S, parts, L, full = item_score(q, pscore)
        lvl = to_level(S); conf = confidence(S, parts)
        # independent criterion: frequency-only (no CEFR-J), FK on stem(+answer) -> own thresholds
        fS = .6 * lex_freq(full) + .4 * interp(avg_sent_len(full), SENT_PTS)
        ilvl = to_level(fS)
        official = q['sourceId'] != 'voa-learning-english'
        reason = ';'.join(f"{k}={v:.1f}x{w}" for k, (v, w) in parts.items()) + (f";hard={','.join(L['hard'])}" if L['hard'] else '')
        rows.append(dict(id=q['id'], grade=q['grade'], skill=q['skill'], topic=q['topicSlug'], src='official' if official else 'voa', S=round(S, 2), level=LV[lvl], lv=lvl, conf=conf, ind=LV[ilvl], ilv=ilvl, reason=reason, text=full[:300], passage=q.get('passageId')))
    json.dump(rows, open(OUT + '/items.json', 'w'), ensure_ascii=False)
    # ---- distribution
    def dist(sel):
        c = collections.Counter(r['lv'] for r in sel); n = len(sel)
        return [c[i] for i in range(5)], n
    print('TOTAL', len(rows), 'voa', sum(r['src'] == 'voa' for r in rows), 'official', sum(r['src'] == 'official' for r in rows))
    print('\nDISTRIBUTION (count and %) Pre-A1 A1 A2 B1 B2')
    def show(name, sel):
        c, n = dist(sel)
        mean = statistics.mean(r['S'] for r in sel) if sel else 0
        med = statistics.median(r['lv'] for r in sel) if sel else 0
        print(f"{name:28s} n={n:5d} " + ' '.join(f"{x:5d}({100*x/n:4.1f}%)" for x in c) + f"  meanS={mean:.2f} medianLv={LV[int(med)] if n else '-'}")
    show('ALL voa', [r for r in rows if r['src'] == 'voa'])
    for g in (6, 7, 8, 9): show(f'voa lop {g}', [r for r in rows if r['src'] == 'voa' and r['grade'] == g])
    show('official (lop-10 entrance)', [r for r in rows if r['src'] == 'official'])
    for sk in ('ngu-phap', 'tu-vung', 'doc-hieu', 'viet-cau'): show(f'voa skill {sk}', [r for r in rows if r['src'] == 'voa' and r['skill'] == sk])
    for sk in ('ngu-phap', 'tu-vung', 'doc-hieu'): show(f'official skill {sk}', [r for r in rows if r['src'] == 'official' and r['skill'] == sk])
    print('\nconfidence: mean', round(statistics.mean(r['conf'] for r in rows), 2), ' low(<0.3):', sum(r['conf'] < .3 for r in rows), ' high(>=0.6):', sum(r['conf'] >= .6 for r in rows))
    # monotonic sanity: Spearman-ish via mean S per grade; also mann-whitney 6 vs 9
    s6 = [r['S'] for r in rows if r['src'] == 'voa' and r['grade'] == 6]; s9 = [r['S'] for r in rows if r['src'] == 'voa' and r['grade'] == 9]
    wins = sum(1 for a in s9 for b in s6 if a > b) + .5 * sum(1 for a in s9 for b in s6 if a == b)
    print('P(random lop9 item scores higher than random lop6 item) =', round(wins / (len(s6) * len(s9)), 3))
    # independent method agreement
    ex = sum(r['lv'] == r['ilv'] for r in rows) / len(rows); w1 = sum(abs(r['lv'] - r['ilv']) <= 1 for r in rows) / len(rows)
    print(f'agreement primary vs frequency-only: exact {ex:.1%}, within one level {w1:.1%}')
    cm = collections.Counter((r['lv'], r['ilv']) for r in rows)
    print('confusion primary(rows) x freq-only(cols):')
    for i in range(5): print(LV[i].ljust(7), [cm[(i, j)] for j in range(5)])
    # passages
    pl = collections.Counter(to_level(s) for s in pscore.values()); print('\nPASSAGES (n=%d):' % len(pscore), {LV[k]: pl[k] for k in range(5)})
    # tests: by existing test definitions
    byid = {r['id']: r for r in rows}; tests = []
    for f in sorted(glob.glob(SRC + 'bank-*.json')):
        for t in json.load(open(f))['tests']:
            lvs = [byid[i]['lv'] for i in t['questionIds'] if i in byid]
            if not lvs: continue
            c = collections.Counter(lvs); med = statistics.median(lvs)
            tests.append(dict(slug=t['slug'], grade=t['grade'], kind=t['kind'], n=len(lvs), median=LV[int(med)], dist=[c[i] for i in range(5)], iq=[c.get(i, 0) for i in range(5)]))
    json.dump(tests, open(OUT + '/tests.json', 'w'), ensure_ascii=False)
    tc = collections.Counter(t['median'] for t in tests); print('TESTS (n=%d) by median level:' % len(tests), dict(tc))
    for kind in ('entrance10',):
        print(kind, [(t['slug'], t['median'], t['dist']) for t in tests if t['kind'] == kind][:3])
    # share of tests with a single level >=70% of items
    pure = sum(1 for t in tests if max(t['dist']) / t['n'] >= .7); print('tests where >=70% items share one level:', pure, '/', len(tests))
    # audit sample: 30 per level, seeded
    rnd = random.Random(20261101); sample = []
    for lv in range(5):
        pool = [r for r in rows if r['lv'] == lv]; k = min(30, len(pool)); sample += rnd.sample(pool, k)
        print('audit pool', LV[lv], len(pool), 'sampled', k)
    with open(OUT + '/audit_sample.csv', 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(['id', 'grade', 'skill', 'src', 'estimated', 'score', 'confidence', 'freq_only_method', 'reason', 'text', 'reviewer_level', 'reviewer_note'])
        for r in sample: w.writerow([r['id'], r['grade'], r['skill'], r['src'], r['level'], r['S'], r['conf'], r['ind'], r['reason'], r['text'], '', ''])
if __name__ == '__main__': main()
