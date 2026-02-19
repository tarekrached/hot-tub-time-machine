CREATE TABLE test_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE test_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES test_sessions(id),
  test_type TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  value_ppm REAL NOT NULL,
  raw_drops INTEGER,
  sample_size_ml INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chemical_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES test_sessions(id),
  chemical TEXT NOT NULL,
  amount_oz REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE maintenance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
