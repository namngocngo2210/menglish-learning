#!/usr/bin/env python3
"""Generate the two static home-page mockups (design reference only)."""
import re

G = [6, 7, 8, 9]
S = [("doc-hieu", "Đọc hiểu"), ("ngu-phap", "Ngữ pháp"), ("tu-vung", "Từ vựng"), ("viet-cau", "Viết câu")]
MASCOT = '<img src="assets/mascot.webp" width="300" height="204" alt="Chú ong BeeJunior đeo kính cầm bút và sách">'


def head(t):
    return f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{t}</title><link rel="stylesheet" href="assets/styles.css"></head><body>
<header class="hdr"><div class="wrap"><a href="/"><img src="assets/logo-lockup.webp" width="154" height="29" alt="BeeJunior"></a>
<nav class="nav" aria-label="Điều hướng chính"><a class="pick" href="#chon-lop">Chọn lớp ▾</a><a class="hide-m" href="/thi-vao-lop-10">Thi vào lớp 10</a><a class="hide-m" href="/luyen-tap-nhom">Luyện tập nhóm</a></nav></div></header>
'''


def footer():
    rows = "".join(
        f'<div><strong><a href="/lop-{g}">Lớp {g}</a></strong>'
        + "".join(f'<a href="/lop-{g}/{s}">{n}</a>' for s, n in S) + "</div>"
        for g in G)
    return f'''<footer class="ftr"><div class="wrap"><div class="row"><a href="/thi-vao-lop-10">Thi vào lớp 10</a><a href="/luyen-tap-nhom">Luyện tập nhóm</a><a href="/nguon-du-lieu">Nguồn dữ liệu</a><a href="/gioi-thieu">Giới thiệu</a><a href="/chinh-sach-bao-mat">Bảo mật</a><a href="/lien-he">Liên hệ</a></div>
<details><summary>Tất cả bài luyện theo lớp</summary><div class="map">{rows}</div></details>
<small>BeeJunior · Luyện tiếng Anh miễn phí, không cần đăng nhập.</small></div></footer></body></html>'''


def chips(extra=""):
    items = "".join(
        f'<li><a href="/lop-{g}"{extra}{" aria-current=\"true\"" if g == 6 and not extra else ""}>{g}</a></li>' for g in G)
    return f'<ul class="chips" id="chon-lop" aria-label="Chọn lớp">{items}</ul>'


def tile(href, icon, b, s, c=""):
    return f'<li><a class="tile {c}" href="{href}"><b>{b}</b><span>{s}</span></a></li>'


TASKS = (tile("/luyen-nhanh", "⏱️", "Luyện nhanh 10 phút", "Đề trộn ngẫu nhiên", "hot")
         + tile("/thi-vao-lop-10", "🎯", "Thi vào lớp 10", "Đề thi và đề luyện")
         + tile("/luyen-tap-nhom", "👥", "Luyện tập nhóm", "Tạo phòng, gửi mã cho bạn"))

a = head("A · Trang chủ kỹ năng trước") + f'''<main><section class="hero"><div class="wrap"><div><p class="eyebrow">Luyện tiếng Anh miễn phí</p><h1>Luyện tiếng Anh từng chút, hiểu vì sao đúng</h1><p>Chọn lớp, chọn kỹ năng, làm bài và xem lời giải. Không cần đăng nhập.</p>
<p class="lbl">Em học lớp mấy?</p>{chips()}</div>{MASCOT}</div></section>
<div class="wrap"><section class="s" aria-labelledby="k"><h2 id="k">Luyện theo kỹ năng <small style="font-size:14px;font-weight:400;color:var(--ink2)">(lớp đang chọn: 6)</small></h2>
<ul class="tiles k4">{tile("/lop-6/doc-hieu", "📖", "Đọc hiểu", "Bài đọc và câu hỏi")}{tile("/lop-6/ngu-phap", "✏️", "Ngữ pháp", "Thì, cấu trúc")}{tile("/lop-6/tu-vung", "🔤", "Từ vựng", "Theo chủ đề")}{tile("/lop-6/viet-cau", "📝", "Viết câu", "Sắp xếp, viết lại")}</ul></section>
<section class="s" aria-labelledby="n"><h2 id="n">Làm ngay</h2><ul class="tiles k3">{TASKS}</ul></section></div></main>
''' + footer()

big = 'style="min-width:72px;min-height:64px;font-size:26px"'
b = head("B · Trang chủ chọn lớp trước") + f'''<main><section class="hero"><div class="wrap"><div><h1>Em học lớp mấy?</h1><p>Chọn lớp để xem bài đọc hiểu, ngữ pháp, từ vựng và viết câu.</p>
{chips(" " + big)}<p style="font-size:14px">Miễn phí · Không cần đăng nhập</p></div>{MASCOT}</div></section>
<div class="wrap"><section class="s" aria-labelledby="n"><h2 id="n">Hoặc làm ngay</h2><ul class="tiles k3">{TASKS}</ul></section></div></main>
''' + footer()

for name, html in (("a-skill-first.html", a), ("b-grade-first.html", b)):
    open(name, "w").write(html)
    h = re.findall(r'href="(/lop-\d+(?:/[a-z-]+)?)"', html)
    print(name, "grade-only", sum(x.count("/") == 1 for x in h), "grade+skill", sum(x.count("/") == 2 for x in h))
