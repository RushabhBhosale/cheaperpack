-- Vehicle recalls from NHTSA (one row per recall campaign).
CREATE TABLE IF NOT EXISTS car_recalls (
  campaign TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  component TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  consequence TEXT NOT NULL DEFAULT '',
  remedy TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  units INTEGER,
  do_not_drive INTEGER NOT NULL DEFAULT 0,
  park_outside INTEGER NOT NULL DEFAULT 0,
  ota INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  idx_rank INTEGER
);
CREATE INDEX IF NOT EXISTS car_recalls_date ON car_recalls (date DESC);

-- Which make / model / model year each campaign affects.
CREATE TABLE IF NOT EXISTS car_vehicles (
  campaign TEXT NOT NULL,
  make_slug TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  PRIMARY KEY (campaign, make_slug, model_slug, year)
);
CREATE INDEX IF NOT EXISTS car_vehicles_mmy ON car_vehicles (make_slug, model_slug, year);
CREATE INDEX IF NOT EXISTS car_vehicles_year ON car_vehicles (year);

-- One row per make / model / year page, with the numbers that decide whether it is indexable.
CREATE TABLE IF NOT EXISTS car_pages (
  make_slug TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  n INTEGER NOT NULL,
  chars INTEGER NOT NULL DEFAULT 0,
  latest TEXT NOT NULL,
  eligible INTEGER NOT NULL DEFAULT 0,
  idx_rank INTEGER,
  PRIMARY KEY (make_slug, model_slug, year)
);
CREATE INDEX IF NOT EXISTS car_pages_make ON car_pages (make_slug, model_slug);
CREATE INDEX IF NOT EXISTS car_pages_rank ON car_pages (eligible, idx_rank);
