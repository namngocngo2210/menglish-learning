#!/usr/bin/env python3
"""Generate the static AFTER mockups (skill, topic, test, mixer). Run: python3 build-mockups.py"""
import math, pathlib
OUT = pathlib.Path(__file__).parent
SIZES = [22, 21, 26, 21, 25, 26, 20, 23, 25, 24, 21, 10]  # real question counts of lop-6/doc-hieu/chung/de-1..12
MIN = lambda n: max(5, int(math.floor(n * 0.7 / 5 + 0.5)) * 5)  # ~0.7 min/question, rounded to 5

HEAD = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{t}</title><link rel="stylesheet" href="assets/styles.css"></head><body>'
HDR = '''<header class="hdr"><div class="wrap"><a href="/" style="display:inline-flex;align-items:center;min-height:44px"><img src="assets/logo-lockup.webp" width="140" height="27" alt="BeeJunior"></a><nav class="nav" aria-label="Điều hướng chính"><a class="pick" href="#">Chọn lớp ▾</a><a class="hide-m" href="#">Thi vào lớp 10</a><a class="hide-m" href="#">Luyện tập nhóm</a></nav></div></header>'''
FTR = '''<footer class="ftr"><div class="wrap"><div class="row"><a href="#">Thi vào lớp 10</a><a href="#">Luyện tập nhóm</a><a href="#">Nguồn dữ liệu</a><a href="#">Giới thiệu</a><a href="#">Bảo mật</a><a href="#">Liên hệ</a></div><small>BeeJunior · Luyện tiếng Anh miễn phí, không cần đăng nhập.</small></div></footer></body></html>'''
ADS = '<div class="ad" role="complementary" aria-label="Vị trí quảng cáo">Vị trí quảng cáo</div>'

def crumb(items):
    """items: list of (label, href|None, cls). Mobile shows the dots link + last 2 crumbs."""
    lis = []
    for i, (label, href, cls) in enumerate(items):
        if href: lis.append(f'<li class="{cls}"><a href="{href}">{label}</a></li>')
        else: lis.append(f'<li><span aria-current="page">{label}</span></li>')
    return lis

def nav(first, mids, last, dots_href, dots_label):
    lis = [f'<li class="mid"><a href="#">⌂<span class="sr" style="position:absolute;left:-9999px">Trang chủ</span></a></li>']
    lis.append(f'<li class="dots"><a href="{dots_href}" aria-label="{dots_label}">…</a></li>')
    lis += [f'<li class="mid"><a href="#">{m}</a></li>' for m in mids]
    return f'<nav class="crumb wrap" aria-label="Đường dẫn"><ol>{"".join(lis)}{last}</ol></nav>'

FAQ_SKILL = '''<details class="faq"><summary>Câu hỏi thường gặp</summary><div><h3>Lớp 6 có bao nhiêu đề đọc hiểu?</h3><p>34 đề với 284 câu hỏi, chia thành đề dài (~20 câu) và đề ngắn (~10 câu).</p><h3>Nên bắt đầu từ đâu?</h3><p>Làm một đề ngắn để làm quen, rồi chuyển sang đề dài. Đọc bài một lần để nắm ý chung trước khi chọn đáp án.</p><h3>Có xem được giải thích đáp án không?</h3><p>Có. Sau khi bấm “Kiểm tra”, mỗi câu hiện đáp án đúng và giải thích bằng tiếng Việt.</p></div></details>'''
FAQ_TOPIC = '''<details class="faq"><summary>Câu hỏi thường gặp</summary><div><h3>Đề dài lớp 6 có bao nhiêu câu hỏi?</h3><p>264 câu trong 12 đề, mỗi đề khoảng 20 câu từ 2–4 bài đọc. Em làm từng đề hoặc làm đề ngẫu nhiên.</p><h3>Ôn đề dài thế nào cho hiệu quả?</h3><p>Làm từng đề, bấm “Kiểm tra” sau mỗi câu để đọc giải thích, rồi làm lại các câu đã sai.</p></div></details>'''

def page(name, title, body):
    (OUT / name).write_text(HEAD.format(t=title) + HDR + '<main>' + body + '</main>' + FTR, encoding='utf-8')

# ---------- 1. Skill page ----------
skill = nav(None, ['Lớp 6'], '<li><span aria-current="page">Đọc hiểu</span></li>', '#', 'Về Lớp 6') + '''<div class="wrap">
<div class="title"><h1>Đọc hiểu lớp 6</h1><p class="ctx">34 đề · 284 câu · có giải thích tiếng Việt</p><p class="intro">Đọc bài ngắn, tìm ý chính, chi tiết và nghĩa của từ trong ngữ cảnh.</p></div>
<div class="cta"><a class="btn" href="#">Làm đề ngẫu nhiên</a></div>
<h2 class="sec">Chọn bộ đề</h2>
<ul class="sets"><li><a class="set" href="#"><b>Đề dài</b><span>12 đề · ~20 câu · ~15 phút/đề</span><span class="st" data-progress>Đã làm 2/12</span></a></li>
<li><a class="set" href="#"><b>Đề ngắn</b><span>22 đề · ~10 câu · ~5 phút/đề</span><span class="st" data-progress></span></a></li></ul>
''' + FAQ_SKILL + ADS + '</div>'
page('after-skill.html', 'Sau · Trang kỹ năng', skill)

# ---------- 2. Topic page ----------
cards = []
for i, n in enumerate(SIZES, 1):
    if i in (1, 2): st, cls, best = f'✓ Tốt nhất {18 if i == 1 else 15}/{n}', ' done', ''
    elif i == 3: st, cls = 'Đang làm dở', ''
    else: st, cls = '', ''
    cards.append(f'<li><a class="test{cls}" href="#"><b>Đề {i}</b><span>{n} câu · ~{MIN(n)} phút</span><span class="st">{st}</span></a></li>')
topic = nav(None, ['Lớp 6', 'Đọc hiểu'], '<li><span aria-current="page">Đề dài</span></li>', '#', 'Về Đọc hiểu lớp 6').replace('<li class="mid"><a href="#">Đọc hiểu</a></li>', '<li class="mid"><a href="#">Đọc hiểu</a></li>') + f'''<div class="wrap">
<div class="title"><h1>Đọc hiểu lớp 6: đề dài</h1><p class="ctx">12 đề · 264 câu · mỗi đề ~20 câu từ 2–4 bài đọc</p></div>
<div class="cta"><a class="btn" href="#">Làm đề ngẫu nhiên</a></div>
<ul class="tests">{"".join(cards)}</ul>
<h2 class="sec">Bộ đề khác</h2>
<ul class="chips"><li><a href="#">Đề ngắn · 22 đề</a></li><li><a href="#">Lớp 7</a></li><li><a href="#">Lớp 8</a></li><li><a href="#">Lớp 9</a></li></ul>
{FAQ_TOPIC}{ADS}</div>'''
page('after-topic.html', 'Sau · Trang chủ đề', topic)

# ---------- 3. Test page and 4. Mixer (same player, different header) ----------
PASSAGE = '''This week on Ask a Teacher, we answer a question from Ann in China. Here is part of Ann’s question:<br><br>Hello Teachers, Could you please help me understand the difference between "extend," "expand," "stretch," [and] "enlarge" when I describe an activity that makes something larger than its current state?<br><br>Thank you, Ann.<br><br>We can use the four verbs Ann asked about to express an increase in physical size or amount. We can also use them to express increasing the time an activity takes.<br><br><b>Extend</b><br>We often use the verb “extend” to talk about increasing the amount of time for an activity or program. For example:<br>Officials want to extend the school year by six weeks.<br><br>We can use the verb “extend” to express an increase in people, things, or ideas. Consider the following examples:<br>The new rule extends to all employees in the company.'''
def q(n, stem, opts):
    o = ''.join(f'<label><input type="radio" name="q{n}"><span lang="en">{k}. {t}</span></label>' for k, t in zip('ABCD', opts))
    return f'<fieldset class="q"><legend>Câu {n}. <span lang="en">{stem}</span></legend>{o}</fieldset>'
QS = q(1, 'The new rule ___ to all employees in the company.', ['provides', 'messages', 'sailors', 'extends']) + q(2, 'Here is part of Ann’s ___:', ['city', 'activity', 'question', 'location']) + q(3, 'Instead, it simply means to ___ in size or scope.', ['mean', 'walk', 'hold', 'increase'])
HOW = '<details class="how"><summary>Cách làm ▾</summary><div>Chọn đáp án → bấm “Kiểm tra” để xem giải thích từng câu → “Nộp bài” để xem điểm. Không giới hạn thời gian; câu bỏ trống tính là chưa đúng.</div></details>'
def bar(total, done_label):
    return f'''<div class="bar"><div class="row"><div class="prog"><b>0/{total} câu</b><div class="meter" role="progressbar" aria-label="Tiến độ" aria-valuemin="0" aria-valuemax="{total}" aria-valuenow="0"><i></i></div></div><a class="btn alt sm" href="#">Tổng quan</a><a class="btn sm" href="#">Nộp bài</a>
<details class="menu"><summary aria-label="Thêm tùy chọn">⋯</summary><div>{done_label}</div></details></div></div>'''
def play(tabs):
    t = ''.join(f'<li><a href="#" {"aria-current=true" if i == 0 else ""}>Bài đọc {i + 1}<small>0/{n}</small></a></li>' for i, n in enumerate(tabs))
    return f'''<ul class="tabs" aria-label="Các bài đọc">{t}</ul>
<div class="play"><section class="passage" aria-labelledby="p1"><div class="row"><h2 id="p1" lang="en">Extend, Expand, etc.</h2><button class="btn alt sm" type="button">Ẩn</button></div><p class="meta">387 từ</p><p class="body" lang="en">{PASSAGE}</p></section>
<div class="qs">{QS}</div></div>'''

# test page
menu_links = '<a href="#">Tạo phòng từ đề này</a><a href="#">Làm đề ngẫu nhiên</a>'
test = nav(None, ['Lớp 6', 'Đọc hiểu'], '<li><a href="#">Đề dài</a></li><li><span aria-current="page">Đề 1</span></li>', '#', 'Về Đọc hiểu lớp 6').replace('<li class="mid"><a href="#">Đọc hiểu</a></li>', '<li class="mid"><a href="#">Đọc hiểu</a></li>') + f'''<div class="wrap">
<div class="title"><h1>Đọc hiểu lớp 6 · Đề dài 1</h1>
<div class="row"><p class="ctx">22 câu · 3 bài đọc · ~15 phút</p>{HOW}</div></div>
{bar(22, menu_links)}
{play([7, 8, 7])}
<nav class="next" aria-label="Đề liên quan"><h2 class="sec" style="margin-top:0">Đề tiếp theo</h2><ul class="chips"><li><a href="#">Đề 2 →</a></li><li><a href="#">Đề 3</a></li><li><a href="#">Cả bộ 12 đề</a></li></ul>
<div class="cta"><a class="btn alt sm" href="#">Tạo phòng từ đề này</a><a class="btn alt sm" href="#">Làm đề ngẫu nhiên khác</a></div></nav>{ADS}</div>'''
page('after-test.html', 'Sau · Trang đề', test)

# mixer: random mode on the topic page. Hero is replaced by a compact header with the same sticky bar.
mixer = nav(None, ['Lớp 6', 'Đọc hiểu'], '<li><a href="#">Đề dài</a></li><li><span aria-current="page">Ngẫu nhiên</span></li>', '#', 'Về Đọc hiểu lớp 6').replace('<li class="mid"><a href="#">Đọc hiểu</a></li>', '<li class="mid"><a href="#">Đọc hiểu</a></li>') + f'''<div class="wrap">
<div class="title"><h1>Đọc hiểu lớp 6: đề dài</h1>
<div class="row"><p class="ctx">Đề ngẫu nhiên · 27 câu · 4 bài đọc · ~20 phút</p>{HOW}</div></div>
{bar(27, '<a href="#">Đề ngẫu nhiên khác</a><a href="#">Quay lại đề cố định</a>')}
{play([6, 8, 8, 5])}{ADS}</div>'''
page('after-mixer.html', 'Sau · Đề ngẫu nhiên', mixer)
print('ok')
