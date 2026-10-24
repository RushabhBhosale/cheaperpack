-- Food recalls from FDA enforcement reports (one row per recall event; products live in `data`).
CREATE TABLE IF NOT EXISTS food_recalls (
  event_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  report_date TEXT NOT NULL,
  firm TEXT NOT NULL,
  firm_slug TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  hazards TEXT NOT NULL DEFAULT '|',
  chars INTEGER NOT NULL DEFAULT 0,
  eligible INTEGER NOT NULL DEFAULT 0,
  idx_rank INTEGER,
  search_text TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS food_date ON food_recalls (report_date DESC, event_id DESC);
CREATE INDEX IF NOT EXISTS food_category ON food_recalls (category, report_date DESC);
CREATE INDEX IF NOT EXISTS food_firm ON food_recalls (firm_slug, report_date DESC);
CREATE INDEX IF NOT EXISTS food_eligible ON food_recalls (eligible, idx_rank);
