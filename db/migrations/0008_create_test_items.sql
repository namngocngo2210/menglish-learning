-- Up Migration
CREATE TABLE test_items (
  test_id      bigint NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  position     smallint NOT NULL,
  question_id  bigint NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  option_order char(4) NOT NULL CHECK (option_order ~ '^[ABCD]{4}$'), -- permutation applied to original options
  PRIMARY KEY (test_id, position),
  UNIQUE (test_id, question_id)
);
CREATE INDEX test_items_question_id_idx ON test_items (question_id);

-- Down Migration
DROP TABLE test_items;
