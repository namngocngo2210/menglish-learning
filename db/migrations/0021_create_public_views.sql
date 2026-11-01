-- Up Migration
-- Public read model for the SSR web (role bj_web: SELECT on these views only). Views run with the
-- owner's privileges, so bj_web needs no table access. Only published content is visible; a test
-- is visible only when every one of its questions is published.
CREATE VIEW v_public_sources AS
  SELECT code, name, base_url, license, attribution
  FROM sources;

CREATE VIEW v_public_topics AS
  SELECT grade, skill, slug, name, description, sort_order
  FROM topics;

CREATE VIEW v_public_passages AS
  SELECT p.external_id AS id, s.code AS source_code, p.title, p.body, p.word_count, p.level,
         p.source_url, p.crawled_at, p.published_at
  FROM passages p
  JOIN sources s ON s.id = p.source_id
  WHERE p.review_status = 'published';

CREATE VIEW v_public_questions AS
  SELECT q.external_id AS id, q.grade, q.skill, t.slug AS topic_slug, q.difficulty,
         ps.external_id AS passage_id, q.stem, q.options, q.correct_key, q.explanation,
         s.code AS source_code, q.source_url, q.source_ref, q.crawled_at, q.published_at
  FROM questions q
  JOIN topics t ON t.id = q.topic_id
  JOIN sources s ON s.id = q.source_id
  LEFT JOIN passages ps ON ps.id = q.passage_id
  WHERE q.review_status = 'published';

CREATE VIEW v_public_tests AS
  SELECT te.slug, te.grade, te.skill, tp.slug AS topic_slug, te.kind, te.title, te.seed,
         te.published_at
  FROM tests te
  LEFT JOIN topics tp ON tp.id = te.topic_id
  WHERE te.review_status = 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM test_items ti
      JOIN questions q ON q.id = ti.question_id
      WHERE ti.test_id = te.id AND q.review_status <> 'published'
    );

CREATE VIEW v_public_test_items AS
  SELECT vt.slug AS test_slug, ti.position, q.external_id AS question_id, ti.option_order
  FROM v_public_tests vt
  JOIN tests te ON te.slug = vt.slug
  JOIN test_items ti ON ti.test_id = te.id
  JOIN questions q ON q.id = ti.question_id;

GRANT SELECT ON v_public_sources, v_public_topics, v_public_passages, v_public_questions,
  v_public_tests, v_public_test_items TO bj_web;

-- Down Migration
DROP VIEW v_public_test_items;
DROP VIEW v_public_tests;
DROP VIEW v_public_questions;
DROP VIEW v_public_passages;
DROP VIEW v_public_topics;
DROP VIEW v_public_sources;
