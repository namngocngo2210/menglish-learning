# Mô hình dữ liệu (PostgreSQL 16)

Migration bằng `goose` trong `db/migrations`, truy vấn sinh bằng `sqlc` từ `db/queries`.

## Thiết kế CMS một chủ — đề xuất, chưa có migration

Bản preview UI không dùng database. Phần này và các bảng bên dưới là **thiết kế đề xuất**, chưa có migration/SQL được duyệt; schema thực tế cần phê duyệt riêng của chủ sở hữu. Không có admin nhiều người: chỉ một tài khoản chủ, tách khỏi tài khoản phụ huynh/học sinh của giai đoạn 2.

Vòng đời nội dung thay thế `questions.status = active/hidden/reported` (áp tương tự cho `passages`):

`review_status`: `quarantine` (mới crawl/import) → `draft` (đang soạn/sửa) → `in_review` (chờ chủ) → `published`; ngoài ra `rejected`, `archived`. Chỉ `published` mới hiện cho học sinh và đưa vào đề. Crawler chỉ được ghi `quarantine`; chuyển sang `published` chỉ do hành động của chủ, có ghi `audit_log`. Không auto-publish.

Bảng bổ sung (thiết kế):

```sql
admin_users (                            -- đúng 1 dòng (chủ); không bảng roles
  id            bigserial PK,
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,           -- argon2id
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NULL
)
admin_sessions (                         -- session phía server, cookie chỉ giữ token ngẫu nhiên
  id            text PK,                 -- hash của token phiên
  admin_user_id bigint FK admin_users,
  csrf_secret   text NOT NULL,
  created_at    timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz NULL
)

-- sources (mở rộng): + allowed_hosts text[] NOT NULL (allowlist chống SSRF),
--   license_checked_at timestamptz NULL, enabled boolean NOT NULL DEFAULT false

crawl_jobs (
  id bigserial PK, source_id bigint FK sources,
  status text NOT NULL,                  -- queued | running | succeeded | failed | cancelled
  started_at timestamptz, finished_at timestamptz,
  fetched_count int NOT NULL DEFAULT 0, quarantined_count int NOT NULL DEFAULT 0, error_count int NOT NULL DEFAULT 0
)
crawl_errors (
  id bigserial PK, crawl_job_id bigint FK crawl_jobs, url text, kind text, message text, created_at timestamptz
)

-- passages, questions: + review_status text NOT NULL DEFAULT 'quarantine',
--   reviewed_at timestamptz NULL, published_at timestamptz NULL, review_note text NULL
--   (thay cột status cũ của questions)

mixer_presets (
  id bigserial PK, name text NOT NULL, grade smallint NOT NULL, skill text NULL,
  config jsonb NOT NULL,                 -- số câu, phân bổ độ khó, nhóm bài đọc
  created_at timestamptz NOT NULL DEFAULT now()
)

-- question_reports (mở rộng): + status text NOT NULL DEFAULT 'open'  -- open | resolved | dismissed
--   handled_at timestamptz NULL, handled_note text NULL

audit_log (
  id bigserial PK, admin_user_id bigint FK admin_users NULL,
  action text NOT NULL,                  -- publish | delete | crawl_start | source_config | login ...
  entity_type text NOT NULL, entity_id bigint NULL,
  details jsonb NULL,                    -- không ghi bí mật/PII không cần thiết
  ip_hash text NULL, created_at timestamptz NOT NULL DEFAULT now()
)
```

Thống kê cơ bản và báo cáo câu sai tính từ `attempts` và `question_reports`. `audit_log` chỉ thêm, không sửa/xóa qua API.

## Bảng giai đoạn 1 (bản đầu, sẽ cập nhật theo thiết kế trên)

```sql
sources (
  id            bigserial PK,
  name          text NOT NULL,          -- "Tatoeba", "Sở GD&ĐT Hà Nội", "VOA Learning English"
  base_url      text NOT NULL,
  license       text NOT NULL,          -- "CC BY 2.0 FR", "CC BY-SA 4.0", "Public domain (US Gov)", "Văn bản chính thức"
  attribution   text NOT NULL           -- dòng ghi nguồn hiển thị trên trang
)

raw_documents (                          -- file gốc đã crawl
  id            bigserial PK,
  source_id     bigint FK sources,
  url           text UNIQUE NOT NULL,
  content_hash  text NOT NULL,
  storage_path  text NOT NULL,          -- file trên volume, không lưu blob trong DB
  fetched_at    timestamptz NOT NULL,
  status        text NOT NULL           -- fetched | parsed | failed | skipped
)

topics (
  id            bigserial PK,
  grade         smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill         text NOT NULL,          -- doc-hieu | ngu-phap | tu-vung | viet-cau
  slug          text NOT NULL,          -- thi-hien-tai-don
  name          text NOT NULL,          -- "Thì hiện tại đơn"
  description   text,
  UNIQUE (grade, skill, slug)
)

passages (
  id            bigserial PK,
  source_id     bigint FK sources,
  raw_document_id bigint FK raw_documents NULL,
  title         text,
  body          text NOT NULL,          -- văn bản thuần đã làm sạch
  word_count    int NOT NULL,
  level         smallint NOT NULL       -- 1..5
)

questions (
  id            bigserial PK,
  grade         smallint NOT NULL,
  skill         text NOT NULL,
  type          text NOT NULL,          -- mcq | cloze | word_order | error_id | rewrite_mcq | synonym | antonym | word_form | stress | pronunciation
  topic_id      bigint FK topics NULL,
  grammar_point text NULL,
  difficulty    smallint NOT NULL,      -- 1 dễ | 2 vừa | 3 khó
  passage_id    bigint FK passages NULL,
  stem          text NOT NULL,
  explanation   text NULL,
  source_id     bigint FK sources NOT NULL,
  source_url    text NOT NULL,
  source_ref    text NULL,              -- năm/tỉnh/mã đề/câu số, id câu Tatoeba...
  stem_hash     text UNIQUE NOT NULL,   -- chống trùng (stem chuẩn hóa)
  status        text NOT NULL DEFAULT 'active',  -- bản đầu; sẽ thay bằng review_status (xem trên)
  created_at    timestamptz NOT NULL DEFAULT now()
)

options (
  id            bigserial PK,
  question_id   bigint FK questions ON DELETE CASCADE,
  label_order   smallint NOT NULL,      -- thứ tự gốc
  body          text NOT NULL,
  is_correct    boolean NOT NULL
)

tests (                                  -- đề cố định (có URL, được index)
  id            bigserial PK,
  slug          text UNIQUE NOT NULL,   -- lop-6/ngu-phap/thi-hien-tai-don/de-1
  grade         smallint NOT NULL,
  skill         text NULL,
  topic_id      bigint FK topics NULL,
  kind          text NOT NULL,          -- topic | mixed | entrance10
  title         text NOT NULL,
  seed          bigint NOT NULL,
  question_ids  bigint[] NOT NULL,      -- thứ tự đã trộn
  published_at  timestamptz NULL
)

attempts (                               -- kết quả ẩn danh
  id            uuid PK,
  test_id       bigint FK tests NULL,   -- NULL = đề ngẫu nhiên
  seed          bigint NOT NULL,
  question_ids  bigint[] NOT NULL,
  option_maps   jsonb NOT NULL,         -- ánh xạ phương án sau khi trộn (server giữ)
  device_hash   text NOT NULL,          -- hash(cookie thiết bị ẩn danh + salt)
  started_at    timestamptz NOT NULL,
  submitted_at  timestamptz NULL,
  score         smallint NULL,
  total         smallint NOT NULL
)

question_reports (                        -- người dùng báo câu sai
  id bigserial PK, question_id bigint FK questions, reason text, device_hash text, created_at timestamptz
)
```

Chỉ mục: `questions(grade, skill, topic_id, difficulty, status)`, `tests(grade, skill, topic_id)`, `attempts(test_id, submitted_at)`.

Thống kê độ khó thực tế (tỉ lệ đúng) tính định kỳ từ `attempts` để chỉnh `difficulty`.

## Dự trữ cho giai đoạn 2

`parents`, `students` (phụ huynh tạo, có đồng ý), `sessions`, `subscriptions`, `payments`, `progress`. Không thu dữ liệu cá nhân ở giai đoạn 1.

## Lưu trữ và sao lưu

- Volume riêng cho Postgres và thư mục `raw` của crawler.
- `pg_dump` hằng ngày, giữ 14 bản; ops theo dõi tuổi bản backup như MEnglish.
