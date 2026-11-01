-- Up Migration
CREATE TABLE mixer_presets (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  grade      smallint NOT NULL CHECK (grade BETWEEN 6 AND 9),
  skill      text CHECK (skill IN ('doc-hieu','ngu-phap','tu-vung','viet-cau')),
  config     jsonb NOT NULL,                          -- {size, difficultyMix, skillMix, maxGroup}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER mixer_presets_touch BEFORE UPDATE ON mixer_presets FOR EACH ROW EXECUTE FUNCTION bj_touch();

-- Down Migration
DROP TABLE mixer_presets;
