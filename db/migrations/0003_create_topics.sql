-- Up Migration
CREATE TABLE topics (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grade       smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill       text NOT NULL CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  slug        text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order  int NOT NULL DEFAULT 0,
  UNIQUE (grade, skill, slug)
);

-- Down Migration
DROP TABLE topics;
