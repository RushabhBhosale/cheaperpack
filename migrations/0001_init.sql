CREATE TABLE IF NOT EXISTS recalls (
  id INTEGER PRIMARY KEY,
  number TEXT NOT NULL,
  slug TEXT NOT NULL,
  date TEXT NOT NULL,
  last_publish TEXT NOT NULL,
  short_title TEXT NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  brand_slug TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  hazards TEXT NOT NULL DEFAULT '|',
  quality INTEGER NOT NULL DEFAULT 0,
  eligible INTEGER NOT NULL DEFAULT 0,
  idx_rank INTEGER,
  search_text TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS recalls_number ON recalls (number);
CREATE INDEX IF NOT EXISTS recalls_date ON recalls (date DESC, id DESC);
CREATE INDEX IF NOT EXISTS recalls_category ON recalls (category, date DESC);
CREATE INDEX IF NOT EXISTS recalls_brand ON recalls (brand_slug, date DESC);
CREATE INDEX IF NOT EXISTS recalls_eligible ON recalls (eligible, idx_rank);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
