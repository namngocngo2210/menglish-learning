from pathlib import Path
from hashlib import sha256
P=Path(__file__).resolve().parent

def icon(name='book'):
    paths={
    'book':'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><path d="M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"/>',
    'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'arrow':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'copy':'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    'link':'<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'check':'<path d="m5 12 4 4L19 6"/>',
    'x':'<path d="m6 6 12 12M6 18 18 6"/>',
    'chevron':'<path d="m9 5 7 7-7 7"/>',
    'shield':'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    'trophy':'<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v6m-4 2h8"/>',
    'door':'<path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h13"/>',
    'wifi':'<path d="m2 2 20 20M3 8a15 15 0 0 1 3-2m4-1a15 15 0 0 1 11 3M6 12a9 9 0 0 1 3-2m5 0a9 9 0 0 1 4 2m-9 4a4 4 0 0 1 4-1"/><circle cx="12" cy="20" r="1"/>',
    'search':'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'spark':'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>'}
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths.get(name,paths["book"])}</svg>'

def btn(t,kind='',ico=None,href=None,focus=False):
    tag='a' if href else 'button'
    attr=f' href="{href}"' if href else ' type="button"'
    return f'<{tag}{attr} class="btn {kind} {"focus-demo" if focus else ""}">{icon(ico) if ico else ""}{t}</{tag}>'

def badge(t,kind=''):
    if t == 'Đã nộp': return f'<span class="badge success">{icon("check")}{t}</span>'
    return f'<span class="badge {kind}">{t}</span>'
def sample():return '<span class="sample">Dữ liệu mẫu</span>'
def field(label,value='',helper='',extra='',type='text'):
    ident='f-'+sha256(label.encode()).hexdigest()[:10]
    return f'<div class="field"><label for="{ident}">{label}</label><input id="{ident}" type="{type}" value="{value}" {extra}>{f"<p class=\"helper\">{helper}</p>" if helper else ""}</div>'
def select(label,options):
    ident='s-'+sha256(label.encode()).hexdigest()[:10]
    return f'<div class="field"><label for="{ident}">{label}</label><select id="{ident}">'+''.join(f'<option>{o}</option>' for o in options)+'</select></div>'
def choices(label,options,selected,multi=False):
    role = 'group' if multi else 'radiogroup'
    buttons = []
    for o in options:
        checked = str(o in selected).lower()
        state = f'aria-pressed="{checked}"' if multi else f'role="radio" aria-checked="{checked}"'
        buttons.append(f'<button type="button" class="chip {"selected" if o in selected else ""}" {state}>{icon("check") if o in selected else ""}{o}</button>')
    return f'<fieldset><legend>{label}</legend><div class="choices" role="{role}" aria-label="{label}">{"".join(buttons)}</div></fieldset>'
def header(reduced=False):
    nav = '<span class="session-label">Luyện tập nhóm</span>' if reduced else '<nav aria-label="Điều hướng chính"><a href="index.html">Lớp 6–9</a><a href="index.html">Thi vào 10</a><a class="active" href="01-landing-mix.html" aria-current="page">Luyện tập nhóm</a></nav>'
    return f'<header class="site-header"><div class="header-inner"><a class="brand" href="index.html" aria-label="BeeJunior · Trang chủ"><img src="assets/beejunior-logo.png" alt="BeeJunior" width="707" height="365"></a>{nav}</div></header>'
def footer():return '<footer><span><strong>BeeJunior</strong> <span class="footer-dot">·</span> Cùng học, cùng tiến bộ.</span><span>Bản tham khảo thiết kế · Dữ liệu mẫu</span></footer>'
def shell(name,title,body,reduced=False,cls=''):
    (P/(name+'.html')).write_text(f'<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} · BeeJunior</title><link rel="stylesheet" href="styles.css"></head><body class="{cls}">{header(reduced)}{body}{footer()}</body></html>\n')
def title(kicker,h,desc=''):
    return f'<div class="page-title"><div class="eyebrow">{kicker}</div><h1>{h}</h1>{f"<p>{desc}</p>" if desc else ""}</div>'
def ad():return '<aside class="ad" aria-label="Vị trí quảng cáo"><span>Quảng cáo (không cá nhân hóa)</span><small>Vị trí minh họa · Không tải nội dung bên ngoài</small></aside>'
def summary():return f'<div class="test-summary"><span class="tile-icon">{icon("book")}</span><div><h3>Thì hiện tại đơn</h3><p>Lớp 7 · Ngữ pháp · 20 câu</p></div>{badge("15 phút")}</div>'

# 01 / 02 — deliberately identical outer layout
for fixed in [False,True]:
    name='02-landing-fixed' if fixed else '01-landing-mix'
    mode='<div class="segmented" role="group" aria-label="Cách chọn đề">'+btn('Đề có sẵn','selected' if fixed else '',href='02-landing-fixed.html')+btn('Trộn theo loại','' if fixed else 'selected',href='01-landing-mix.html')+'</div>'
    if fixed:
        config=f'<div class="configuration fixed-config">{field("Dán đường dẫn hoặc chọn đề","/lop-7/ngu-phap/thi-hien-tai-don/de-1",extra="class=\"slug\"")}<div class="picked-test"><div class="row between">{badge("Đề đã chọn", "warm")}{sample()}</div>{summary()}<p>Ôn cách dùng, dấu hiệu nhận biết và cấu trúc câu trong thì hiện tại đơn.</p>{btn("Chọn đề khác","text-btn","search")}</div><div class="quiet-note">{icon("shield")}<span>Cả phòng làm cùng một đề, trong cùng một lượt.</span></div></div>'
    else:
        config='<div class="configuration">'+choices('Khối lớp',['Lớp 6','Lớp 7','Lớp 8','Lớp 9'],['Lớp 7'])+choices('Kỹ năng · có thể chọn nhiều',['Đọc hiểu','Ngữ pháp','Từ vựng','Viết câu'],['Ngữ pháp','Từ vựng'],True)+select('Chủ đề',['Trường học & cuộc sống','Gia đình','Sở thích','Tất cả chủ đề'])+'<div class="two-fields">'+choices('Số câu hỏi',['10','20','40'],['20'])+choices('Độ khó',['Dễ','Vừa','Khó','Cân bằng'],['Cân bằng'])+'</div></div>'
    create=f'<section class="card create-card"><div class="section-heading"><span class="tile-icon">{icon("plus")}</span><div><h2>Tạo phòng</h2><p>Chọn đề, rủ bạn và bắt đầu.</p></div>{sample()}</div>{mode}{config}<div class="form-divider"></div><div class="two-fields">{choices("Giới hạn thời gian",["Không","15 phút"],["15 phút"])}{select("Số người tối đa",["10 người","2 = đấu đôi","5 người","20 người","30 người"])}</div>{field("Tên hiển thị","Minh","Dùng tên gọi, không dùng họ tên đầy đủ hoặc số điện thoại",extra="maxlength=\"20\"")}{btn("Tạo phòng","primary wide","arrow",href="04-lobby.html",focus=True)}</section>'
    join=f'<aside class="landing-side"><section class="card join-card"><span class="tile-icon">{icon("users")}</span><h2>Vào phòng bằng mã</h2><p>Bạn đã có lời mời? Nhập mã để tham gia cùng nhóm.</p>{sample()}{field("Mã phòng","K7M2QX",extra="maxlength=\"6\" class=\"code-input\" spellcheck=\"false\"")}{btn("Vào phòng","sky wide","arrow",href="03-join.html")}<div class="quiet-note">{icon("shield")}<span>Không cần tạo tài khoản.</span></div></section><div class="side-note"><span class="note-line"></span><h3>Một đề. Cả nhóm.<br>Cùng chinh phục.</h3><p>Tập trung làm bài theo nhịp của mình. Xếp hạng chỉ hiện khi lượt chơi kết thúc.</p><div class="mini-avatars"><span>M</span><span>A</span><span>L</span><span>+3</span></div></div></aside>'
    body=f'<main class="container">{title("HỌC CÙNG BẠN, THÊM ĐỘNG LỰC","Luyện tập nhóm","Cùng làm một đề, cùng lúc, xếp hạng khi nộp bài. Không cần tài khoản.")}<div class="landing-grid">{create}{join}</div><section class="steps" aria-label="Cách chơi"><div><span>01</span><h3>Tạo phòng</h3><p>Chọn đề phù hợp với nhóm.</p></div><div><span>02</span><h3>Gửi mã/đường dẫn</h3><p>Rủ bạn vào chung một phòng.</p></div><div><span>03</span><h3>Chủ phòng bấm Bắt đầu</h3><p>Cùng làm bài và xem xếp hạng.</p></div></section><section class="ground-rules"><h2>Học vui, thông tin gọn nhẹ.</h2><ul><li>Không cần tài khoản</li><li>Không có tính năng chat</li><li>Chỉ lưu tên hiển thị tạm trong phòng</li></ul></section>{ad()}</main>'
    shell(name,'Luyện tập nhóm',body)

# 03
body=f'<main class="container narrow">{title("SẴN SÀNG HỌC CÙNG NHAU","Vào phòng thôi!","Chỉ cần một tên gọi để bạn bè nhận ra bạn.")}<div class="join-layout"><section class="card"><div class="row between"><span class="label">Mã phòng</span>{sample()}</div><div class="room-code small-code">K7M2QX</div>{field("Tên hiển thị","An","Dùng tên gọi, không dùng họ tên đầy đủ hoặc số điện thoại",extra="maxlength=\"20\"")}{btn("Vào phòng","primary wide","arrow",href="04-lobby.html",focus=True)}<p class="helper centered">Không cần tài khoản.<br>Tên chỉ tồn tại trong phòng này.</p></section><aside class="room-overview"><span class="tile-icon">{icon("users")}</span><h2>Phòng của Minh (mẫu)</h2><p>Lớp 7 · Ngữ pháp · 20 câu</p><div class="form-divider"></div><div class="row">{icon("users")}<strong>4/10 người</strong></div><p>Các bạn đang chờ ở phòng.<br>Vào cùng học nhé!</p>{badge("Chưa bắt đầu","warm")}</aside></div></main>'
shell('03-join','Vào phòng',body)

players=['Minh','An','Linh','Huy','Mai','Nam']
def player_rows(wait=False):
    out=''
    for i,n in enumerate(players):
        status=['Đã nộp','Đã nộp','Đã nộp','Đang làm','Đang làm','Mất kết nối'][i] if wait else ('Mất kết nối' if i==5 else 'Sẵn sàng')
        badges=(badge('Chủ phòng','warm') if i==0 else '')+(badge('Bạn','warm') if i==1 else '')
        out+=f'<li class="player {"disconnected" if i==5 else ""}"><span class="avatar av-{i%3}">{n[0]}</span><div class="player-name"><strong>{n}</strong><div class="player-badges">{badges}</div></div>{badge(status,"muted" if i==5 else ("warm" if status=="Đang làm" else "")) if wait or i==5 else "<span class=\"ready\">"+icon('check')+"<span>Đã vào</span></span>"}{f"<button type=\"button\" class=\"kick\" aria-label=\"Mời {n} ra khỏi phòng\">{icon('x')}</button>" if not wait and i!=0 else ""}</li>'
    return '<ul class="players">'+out+'</ul>'
#04
body=f'<main class="container">{title("PHÒNG CỦA MINH (MẪU)","Tập hợp đủ, cùng bắt đầu!","Gửi mã hoặc đường dẫn cho bạn bè để vào chung phòng.")}<div class="lobby-grid"><section class="card"><div class="row between"><h2>Người chơi <span class="count">6/10 người</span></h2>{sample()}</div>{player_rows()}<div class="quiet-note">{icon("shield")}<span>Chỉ dùng tên gọi. Trong phòng không có chat.</span></div></section><aside class="stack"><section class="card code-card"><p class="eyebrow">MÃ PHÒNG</p><div class="room-code">K7M2QX</div><div class="copy-actions">{btn("Sao chép mã","","copy",focus=True)}{btn("Sao chép đường dẫn","","link")}</div></section><section class="card">{summary()}<div class="form-divider"></div><p class="status-line"><span class="status-dot"></span>Đang chờ người chơi…</p>{btn("Bắt đầu","primary wide","arrow",href="05-play.html")}<p class="helper centered">Cần ít nhất 2 người</p>{btn("Rời phòng","wide text-btn","door",href="01-landing-mix.html")}</section></aside></div><section class="variant-card"><span class="tile-icon">{icon("clock")}</span><div><span class="eyebrow">Góc nhìn người chơi</span><h3>Chờ chủ phòng bấm Bắt đầu…</h3><p>Bạn đã vào phòng. Đề sẽ mở cùng lúc cho tất cả.</p></div>{badge("Đang chờ","warm")}</section></main>'
shell('04-lobby','Phòng chờ',body)
#05
nums=''.join(f'<button type="button" aria-label="Câu {i}{", đã trả lời" if i<=18 else ", chưa trả lời" if i in [19,20] else ", đang xem"}" class="q-num {"current" if i==7 else "answered" if i<=18 else ""}" {"aria-current=\"step\"" if i==7 else ""}>{i}</button>' for i in range(1,21))
options=''.join(f'<button type="button" class="option {"selected focus-demo" if i==1 else ""}" aria-pressed="{str(i==1).lower()}"><span class="option-letter">{chr(65+i)}</span><span>{t}</span>{icon("check") if i==1 else ""}</button>' for i,t in enumerate(['She reads books in the library.','She plays badminton with her friends.','She visits her grandparents.','She watches a film at home.']))
body=f'<main class="container play-container"><section class="play-top"><div class="question-progress"><div class="row between"><strong>Câu 7<span class="muted-text">/20</span></strong><span class="helper">Đang làm bài</span></div><div class="progress"><span></span></div></div><span class="timer">{icon("clock")}12:40</span><div class="submission"><div class="avatar-dots"><i></i><i></i><i></i></div><span>Đã nộp: <strong>3/6 người</strong></span></div></section><div class="play-grid"><section class="card question-card"><div class="row between">{badge("Đọc hiểu","warm")}{sample()}</div><details class="passage" open><summary>Đoạn văn đọc hiểu <span class="helper">· Dữ liệu mẫu</span></summary><p lang="en">Every Saturday, Lan goes to the sports centre near her house. She plays badminton with her friends in the morning. In the afternoon, she reads books at home. She enjoys her weekends because she can stay active and learn new things.</p></details><p class="question-instruction">Chọn một đáp án phù hợp nhất.</p><h1 class="question-stem" lang="en">What does Lan do on Saturday morning?</h1><div class="options">{options}</div><div class="question-nav">{btn("Câu trước","","chevron")}{btn("Câu sau","sky","arrow")}</div></section><aside class="stack"><section class="card navigator"><h2>Câu hỏi</h2><p class="helper">18/20 câu đã trả lời</p><div class="question-grid">{nums}</div><div class="grid-legend"><span><i class="answered"></i>Đã trả lời</span><span><i></i>Chưa trả lời</span></div><div class="form-divider"></div><p class="remaining">Còn 2 câu chưa trả lời</p>{btn("Nộp bài","primary wide","check",href="06-waiting.html")}<p class="helper">Bạn sẽ xác nhận trước khi nộp.</p></section><div class="quiet-note">{icon("shield")}<span>Kết quả chỉ hiện khi cả phòng kết thúc lượt chơi.</span></div></aside></div></main>'
shell('05-play','Đang làm bài',body,True)
#06
body=f'<main class="container waiting-container"><div class="submission-hero"><span class="large-icon">{icon("check")}</span>{title("ĐÃ GỬI BÀI LÀM","Bạn đã nộp bài.","Đang chờ 3 người nữa…")}<p>Cứ nghỉ một chút. Kết quả sẽ hiện khi lượt chơi kết thúc.</p></div><div class="waiting-grid"><section class="card"><div class="row between"><h2>Tiến độ của cả phòng</h2>{sample()}</div><div class="waiting-stat"><strong>3/6</strong><span>người đã nộp bài</span><div class="progress"><span style="width:50%"></span></div></div>{player_rows(True)}</section><aside class="stack"><section class="card">{summary()}<p class="helper">Mã phòng <strong>K7M2QX</strong></p><div class="quiet-note">{icon("shield")}<span>Chưa hiển thị điểm để mọi người tập trung hoàn thành bài.</span></div></section><section class="card host-controls">{badge("Dành cho chủ phòng","warm")}<h2>Kết thúc lượt chơi?</h2><p>Nên chờ các bạn hoàn thành bài nếu còn thời gian.</p>{btn("Kết thúc sớm","outline-sky wide","clock",focus=True)}<p class="helper">Kết thúc cho tất cả. Người chưa nộp được chấm theo các câu đã trả lời.</p></section></aside></div></main>'
shell('06-waiting','Đã nộp bài',body,True)
#07
ranks=[(1,'Linh','18/20','90%'),(2,'An','17/20','85%'),(2,'Minh','17/20','85%'),(4,'Huy','15/20','75%'),(5,'Mai','14/20','70%'),(6,'Nam','10/20','50%')]
rows=''.join(f'<tr class="{"own-row" if n=="An" else ""}"><td><span class="rank">{r}</span></td><th scope="row">{n} {badge("Bạn","warm") if n=="An" else ""}</th><td>{c}</td><td><strong>{pct}</strong></td></tr>' for r,n,c,pct in ranks)
podium=''.join(f'<div class="podium-place place-{r}"><span class="podium-medal">{icon("trophy") if r==1 else str(r)}</span><span class="avatar av-{r%3}">{n[0]}</span><h3>{n} {badge("Bạn","warm") if n=="An" else ""}</h3><p>{c} câu đúng</p><div class="podium-base"><span>Hạng {r}</span></div></div>' for r,n,c in [(2,'An',17),(1,'Linh',18),(2,'Minh',17)])
body=f'<main class="container results-container">{title("LƯỢT CHƠI ĐÃ KẾT THÚC","Một lượt học, nhiều tiến bộ!","Cùng nhìn lại kết quả và sẵn sàng cho lần tiếp theo.")}<div class="row between results-caption"><span>Thì hiện tại đơn <span class="muted-text">· Lớp 7 · 20 câu</span></span>{sample()}</div><section class="podium" aria-label="Ba người dẫn đầu">{podium}</section><section class="card ranking"><div class="row between"><h2>Bảng xếp hạng</h2>{badge("6 người chơi")}</div><table><thead><tr><th scope="col">Hạng</th><th scope="col">Tên</th><th scope="col">Số câu đúng</th><th scope="col">Tỷ lệ</th></tr></thead><tbody>{rows}</tbody></table><p class="helper tie-note">Bằng điểm: xếp chung hạng; thứ tự trong hạng theo thứ tự vào phòng, không theo tốc độ</p></section><div class="result-actions">{btn("Chơi lại cùng phòng","primary","arrow",href="04-lobby.html",focus=True)}{btn("Xem đáp án và giải thích","sky","book",href="#review")}</div><p class="helper centered">Chơi lại cùng phòng: dành cho chủ phòng.</p><details id="review" class="card review"><summary><span><strong>Câu 12</strong><span class="review-label">Câu bạn trả lời sai · Bài làm của bạn</span></span>{badge("Xem giải thích","warm")}</summary><p class="answer-error">{icon("x")} Bạn chọn: “She go to school every day.”</p><p class="answer-success">{icon("check")} Đáp án: “She goes to school every day.”</p><p>Với chủ ngữ “She”, động từ “go” thêm “es” ở thì hiện tại đơn.</p></details><div class="secondary-actions">{btn("Tạo phòng mới","","plus",href="01-landing-mix.html")}{btn("Về trang chủ","text-btn",href="index.html")}</div>{ad()}</main>'
shell('07-results','Kết quả lượt chơi',body)
#08 09
for notfound in [False,True]:
    name='09-error-notfound' if notfound else '08-error-full'
    h='Không tìm thấy phòng' if notfound else 'Phòng đã đủ người'
    desc='Có thể mã chưa đúng hoặc phòng đã hết hạn. Kiểm tra lại mã với chủ phòng nhé.' if notfound else 'Phòng này đã có đủ 10/10 người. Bạn có thể tạo một phòng mới và rủ các bạn cùng vào.'
    actions=field('Mã phòng','K7M2QX','Mã có 6 ký tự, không phân biệt hoa thường',extra='maxlength="6" class="code-input"')+btn('Thử lại','primary wide','arrow',focus=True)+btn('Tạo phòng mới','wide text-btn',href='01-landing-mix.html') if notfound else '<div class="error-actions">'+btn('Tạo phòng mới','primary','plus',href='01-landing-mix.html',focus=True)+btn('Nhập mã khác','','arrow',href='03-join.html')+'</div>'
    body=f'<main class="container error-container"><div class="error-route">Luyện tập nhóm <span>/</span> Vào phòng</div><section class="card error-card"><span class="large-icon">{icon("search" if notfound else "users")}</span><div class="row centered">{badge("MÃ PHÒNG K7M2QX")}{sample()}</div><h1>{h}</h1><p>{desc}</p>{badge("10/10 người","warm") if not notfound else ""}<div class="retry-form">{actions}</div></section><p class="helper centered">Không cần tài khoản. Chỉ cần một mã phòng còn hoạt động.</p></main>'
    shell(name,h,body)
#10
body=f'<main class="container hostleft-container">{title("KẾT NỐI PHÒNG","Chủ phòng đã rời đi","Điều gì xảy ra tiếp theo phụ thuộc vào lúc phòng bị ngắt kết nối.")}<div class="row between hostleft-caption"><span>Mã phòng <strong>K7M2QX</strong></span>{sample()}</div><div class="hostleft-grid"><section class="card"><div class="row between">{badge("01 · Đang ở phòng chờ","warm")}{icon("door")}</div><h2>Phòng đã đóng</h2><p>Chủ phòng đã rời đi trước khi bắt đầu. Hãy tạo phòng mới để tiếp tục học cùng các bạn.</p><div class="closed-room">{icon("users")}<span>Lượt chơi chưa bắt đầu</span></div>{btn("Tạo phòng mới","primary wide","plus",href="01-landing-mix.html",focus=True)}{btn("Nhập mã khác","wide text-btn",href="03-join.html")}</section><section class="card midgame"><div class="row between">{badge("02 · Đang làm bài","warm")}{icon("wifi")}</div><h2>Bạn vẫn có thể làm tiếp</h2><p>Chủ phòng mất kết nối. Bạn vẫn có thể nộp bài; kết quả sẽ hiện khi mọi người nộp xong hoặc sau 5 phút.</p><div class="countdown-box"><span class="timer">{icon("clock")}04:32</span><span class="helper">Còn lại trước khi<br>hiện kết quả</span></div>{btn("Tiếp tục làm bài","sky wide","arrow",href="05-play.html")}{btn("Nộp bài","wide text-btn","check",href="06-waiting.html")}</section></div><div class="quiet-note">{icon("shield")}<span>Các câu đã trả lời được giữ lại trong lượt chơi hiện tại.</span></div></main>'
shell('10-error-hostleft','Chủ phòng đã rời đi',body)
# index
names=[('01-landing-mix','Tạo phòng · Trộn theo loại'),('02-landing-fixed','Tạo phòng · Đề có sẵn'),('03-join','Vào phòng bằng mã'),('04-lobby','Phòng chờ · Chủ phòng'),('05-play','Đang làm bài'),('06-waiting','Đã nộp · Chờ cả nhóm'),('07-results','Kết quả & xếp hạng'),('08-error-full','Phòng đã đủ người'),('09-error-notfound','Không tìm thấy phòng'),('10-error-hostleft','Chủ phòng đã rời đi')]
links=''.join(f'<a class="card screen-link {"focus-demo" if i==0 else ""}" href="{n}.html"><span class="eyebrow">{i+1:02d}</span><h2>{t}</h2>{icon("arrow")}<span class="helper">HTML · <span>1440px / 390px</span></span></a>' for i,(n,t) in enumerate(names))
shell('index','Bộ mockup luyện tập nhóm',f'<main class="container">{title("THAM KHẢO THIẾT KẾ","Luyện tập nhóm","10 màn hình tĩnh · Vàng / xanh trời / mực · Be Vietnam Pro cục bộ")}<p>{sample()} <span class="helper">Design reference only, sample data</span></p><div class="index-grid">{links}</div></main>')
print('Generated 10 screens and index.html')
