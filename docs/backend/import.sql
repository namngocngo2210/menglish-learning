-- Idempotent importer prototype (SQL over a JSON staging table). Run inside one transaction.
\timing on
BEGIN;
CREATE TEMP TABLE stg (ord int, layer text, file text, doc jsonb) ON COMMIT DROP;
\copy stg FROM '/work/stg.tsv'

-- sources (union; published layer wins)
INSERT INTO sources (code, name, base_url, license, attribution)
SELECT DISTINCT ON (s->>'id') s->>'id', s->>'name', s->>'baseUrl', s->>'license', s->>'attribution'
FROM stg, jsonb_array_elements(doc->'sources') s ORDER BY s->>'id', ord DESC
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, base_url=EXCLUDED.base_url,
  license=EXCLUDED.license, attribution=EXCLUDED.attribution;

INSERT INTO topics (grade, skill, slug, name, description)
SELECT DISTINCT ON ((t->>'grade')::int, t->>'skill', t->>'slug')
  (t->>'grade')::int, t->>'skill', t->>'slug', t->>'name', t->>'description'
FROM stg, jsonb_array_elements(doc->'topics') t
ORDER BY (t->>'grade')::int, t->>'skill', t->>'slug', ord DESC
ON CONFLICT (grade, skill, slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

-- topics referenced by questions but absent from bundle topic lists (mixed/entrance-only classifications)
INSERT INTO topics (grade, skill, slug, name)
SELECT DISTINCT (q->>'grade')::int, q->>'skill', q->>'topicSlug', q->>'topicSlug'
FROM stg, jsonb_array_elements(doc->'questions') q
ON CONFLICT (grade, skill, slug) DO NOTHING;

INSERT INTO passages (external_id, source_id, title, body, word_count, level, source_url, crawled_at, review_status, published_at, reviewed_at)
SELECT DISTINCT ON (p->>'id') p->>'id', src.id, p->>'title', p->>'body', (p->>'wordCount')::int, (p->>'level')::int,
  p->>'sourceUrl', (p->>'crawledAt')::timestamptz, 'quarantine', NULL, NULL
FROM stg, jsonb_array_elements(doc->'passages') p JOIN sources src ON src.code = p->>'sourceId'
WHERE layer='q' ORDER BY p->>'id', ord DESC
ON CONFLICT (external_id) DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body;

-- quarantine layer: every question as quarantine
INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, passage_id, stem, options, correct_key, explanation,
  source_id, source_url, source_ref, crawled_at, review_status)
SELECT DISTINCT ON (q->>'id') q->>'id', (q->>'grade')::int, q->>'skill', tp.id, (q->>'difficulty')::int, ps.id,
  q->>'stem', q->'options', q->>'correctKey', q->>'explanation', src.id, q->>'sourceUrl', q->>'sourceRef',
  (q->>'crawledAt')::timestamptz, 'quarantine'
FROM stg, jsonb_array_elements(doc->'questions') q
JOIN sources src ON src.code = q->>'sourceId'
JOIN topics tp ON tp.grade=(q->>'grade')::int AND tp.skill=q->>'skill' AND tp.slug=q->>'topicSlug'
LEFT JOIN passages ps ON ps.external_id = q->>'passageId'
WHERE layer='q' ORDER BY q->>'id', ord DESC
ON CONFLICT (external_id) DO NOTHING;

-- published layer overrides status/topic/explanation (idempotent)
UPDATE questions x SET
  topic_id = tp.id, explanation = q->>'explanation', difficulty = (q->>'difficulty')::int,
  review_status = 'published', review_note = q->>'reviewNote',
  reviewed_at = (q->>'reviewedAt')::timestamptz, published_at = (q->>'reviewedAt')::timestamptz
FROM (SELECT DISTINCT ON (q->>'id') q FROM stg, jsonb_array_elements(doc->'questions') q WHERE layer='p' ORDER BY q->>'id', ord DESC) pq(q)
JOIN topics tp ON tp.grade=(q->>'grade')::int AND tp.skill=q->>'skill' AND tp.slug=q->>'topicSlug'
WHERE x.external_id = q->>'id';

-- provenance for official exams: "2026 | Hà Nội | kind | Mã đề 001 | Question 22 | ocr-transcribed"
UPDATE questions SET provenance = jsonb_build_object(
    'year', (string_to_array(source_ref,' | '))[1]::int,
    'province', (string_to_array(source_ref,' | '))[2],
    'examKind', (string_to_array(source_ref,' | '))[3],
    'examCode', regexp_replace((string_to_array(source_ref,' | '))[4], '^Mã đề ', ''),
    'itemRef', (string_to_array(source_ref,' | '))[5],
    'method', (string_to_array(source_ref,' | '))[6])
WHERE external_id LIKE 'gov-%' AND source_ref ~ '^[0-9]{4} \| ';

UPDATE passages p SET review_status='published', published_at='2026-10-31T00:00:00Z', reviewed_at='2026-10-31T00:00:00Z'
WHERE EXISTS (SELECT 1 FROM questions q WHERE q.passage_id=p.id AND q.review_status='published');

-- tests + items
INSERT INTO tests (slug, grade, skill, topic_id, kind, title, seed, review_status, published_at)
SELECT t->>'slug', (t->>'grade')::int, t->>'skill', tp.id, t->>'kind', t->>'title', t->>'seed', 'published', (t->>'publishedAt')::timestamptz
FROM stg, jsonb_array_elements(doc->'tests') t
LEFT JOIN topics tp ON tp.grade=(t->>'grade')::int AND tp.skill=t->>'skill' AND tp.slug=t->>'topicSlug'
WHERE layer='p'
ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, seed=EXCLUDED.seed, topic_id=EXCLUDED.topic_id;

INSERT INTO test_items (test_id, position, question_id, option_order)
SELECT te.id, (i.ord-1)::int, qq.id, COALESCE(t->'optionOrder'->>(i.qid), 'ABCD')
FROM stg, jsonb_array_elements(doc->'tests') t
CROSS JOIN LATERAL jsonb_array_elements_text(t->'questionIds') WITH ORDINALITY i(qid, ord)
JOIN tests te ON te.slug = t->>'slug'
JOIN questions qq ON qq.external_id = i.qid
WHERE layer='p'
ON CONFLICT (test_id, position) DO UPDATE SET question_id=EXCLUDED.question_id, option_order=EXCLUDED.option_order;
COMMIT;

-- parity report
SELECT review_status, count(*) FROM questions GROUP BY 1 ORDER BY 1;
SELECT split_part(external_id,'-',1) src, review_status, count(*) FROM questions GROUP BY 1,2 ORDER BY 1,2;
SELECT 'sources' t, count(*) FROM sources UNION ALL SELECT 'topics', count(*) FROM topics
 UNION ALL SELECT 'passages', count(*) FROM passages UNION ALL SELECT 'passages_pub', count(*) FROM passages WHERE review_status='published'
 UNION ALL SELECT 'tests', count(*) FROM tests UNION ALL SELECT 'test_items', count(*) FROM test_items;
SELECT kind, count(*) FROM tests GROUP BY 1 ORDER BY 1;
