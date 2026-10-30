# Mô hình dữ liệu (PostgreSQL 16)

Migration bằng `goose` trong `db/migrations`, truy vấn sinh bằng `sqlc` từ `db/queries`.

## Khoảng trống thiết kế CMS một chủ — chưa có migration

Bản preview UI v2 không dùng database và không triển khai schema. Các bảng bên dưới là đề xuất ban đầu, **chưa đủ cho CMS**: `questions.status = active/hidden/reported` không mô tả vòng đời kiểm duyệt. Thiết kế tiếp theo cần phân biệt ingestion quarantine, draft, owner review và published; lưu giấy phép/ghi nguồn + lịch sử duyệt, crawl jobs/failure, preset và audit publish/delete/crawl/config. Chỉ nội dung đã được chủ kiểm tra mới có thể publish, không auto-publish. Một tài khoản owner/session phía server cần thiết kế bảo mật riêng, không trộn với tài khoản học sinh giai đoạn 2.

Đây chỉ là ghi nhận khoảng trống; chưa chốt bảng/enum/API mới và không sửa SQL bên dưới thành schema đã duyệt. Auth/schema/API thực tế cần phê duyệt riêng của chủ sở hữu. Không có lời hứa bảo vệ dữ liệu từ bản static export.

## Bảng giai đoạn 1

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
  status        text NOT NULL DEFAULT 'active',  -- active | hidden | reported
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
