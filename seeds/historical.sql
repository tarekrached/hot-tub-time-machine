-- seeds/historical.sql
-- Historical backfill: 32 test sessions (2025-06-25 through 2026-02-15)
-- 2 maintenance events: drain_refill 2025-11-08, filter_change 2026-02-01
-- NOTE: chemical_additions are NOT included (oz amounts not recorded in source log)
--
-- Apply locally:   npx wrangler d1 execute hot-tub-time-machine --local --file=seeds/historical.sql
-- Apply remotely:  npx wrangler d1 execute hot-tub-time-machine --remote --file=seeds/historical.sql
--
-- Safe to re-run (INSERT OR IGNORE on explicit IDs).
-- Run AFTER: npx wrangler d1 migrations apply hot-tub-time-machine --local
--
-- Ongoing backup: regenerate from production and commit periodically:
--   npx wrangler d1 export hot-tub-time-machine --remote --no-schema --output=seeds/historical.sql
--   git add seeds/historical.sql && git commit -m "chore: update DB seed"

-- ============================================================
-- SESSIONS (32 total)
-- ============================================================
INSERT OR IGNORE INTO test_sessions (id, started_at, completed_at, notes) VALUES
  (1,  '2025-06-25 10:00:00', '2025-06-25 10:30:00', NULL),
  (2,  '2025-06-30 10:00:00', '2025-06-30 10:30:00', NULL),
  (3,  '2025-07-04 10:00:00', '2025-07-04 10:30:00', NULL),
  (4,  '2025-07-12 10:00:00', '2025-07-12 10:30:00', NULL),
  (5,  '2025-07-21 10:00:00', '2025-07-21 10:30:00', NULL),
  (6,  '2025-07-22 10:00:00', '2025-07-22 10:30:00', NULL),
  (7,  '2025-08-04 10:00:00', '2025-08-04 10:30:00', NULL),
  (8,  '2025-08-11 10:00:00', '2025-08-11 10:30:00', NULL),
  (9,  '2025-08-16 10:00:00', '2025-08-16 10:30:00', NULL),
  (10, '2025-08-23 10:00:00', '2025-08-23 10:30:00', NULL),
  (11, '2025-08-24 10:00:00', '2025-08-24 10:30:00', NULL),
  (12, '2025-09-03 10:00:00', '2025-09-03 10:30:00', NULL),
  (13, '2025-09-09 10:00:00', '2025-09-09 10:30:00', NULL),
  (14, '2025-09-15 10:00:00', '2025-09-15 10:30:00', NULL),
  (15, '2025-09-23 10:00:00', '2025-09-23 10:30:00', NULL),
  (16, '2025-10-04 10:00:00', '2025-10-04 10:30:00', NULL),
  (17, '2025-10-10 10:00:00', '2025-10-10 10:30:00', NULL),
  (18, '2025-10-18 10:00:00', '2025-10-18 10:30:00', NULL),
  (19, '2025-11-03 10:00:00', '2025-11-03 10:30:00', NULL),
  (20, '2025-11-08 10:00:00', '2025-11-08 10:30:00', 'Post drain/refill rebalance'),
  (21, '2025-11-16 10:00:00', '2025-11-16 10:30:00', NULL),
  (22, '2025-11-26 10:00:00', '2025-11-26 10:30:00', NULL),
  (23, '2025-12-03 10:00:00', '2025-12-03 10:30:00', NULL),
  (24, '2025-12-10 10:00:00', '2025-12-10 10:30:00', NULL),
  (25, '2025-12-14 10:00:00', '2025-12-14 10:30:00', NULL),
  (26, '2025-12-31 10:00:00', '2025-12-31 10:30:00', NULL),
  (27, '2026-01-07 10:00:00', '2026-01-07 10:30:00', NULL),
  (28, '2026-01-13 10:00:00', '2026-01-13 10:30:00', NULL),
  (29, '2026-01-22 10:00:00', '2026-01-22 10:30:00', NULL),
  (30, '2026-02-01 10:00:00', '2026-02-01 10:30:00', NULL),
  (31, '2026-02-08 10:00:00', '2026-02-08 10:30:00', NULL),
  (32, '2026-02-15 10:00:00', '2026-02-15 10:30:00', NULL);

-- ============================================================
-- MAINTENANCE EVENTS
-- ============================================================
-- drain_refill timestamped at 09:00 (before the 10:00 test session on the same day — correct order)
-- filter_change on 2026-02-01 confirmed by user (not in the markdown log, added separately)
INSERT OR IGNORE INTO maintenance_events (id, event_type, created_at, notes) VALUES
  (1, 'drain_refill',  '2025-11-08 09:00:00', NULL),
  (2, 'filter_change', '2026-02-01 09:00:00', NULL);

-- ============================================================
-- TEST READINGS (111 total)
-- Insertion order: TA → Bromine → pH → Calcium (app test order)
-- "✓" end = skip after reading. "—" = skip entirely.
-- pH sentinels: <7.x stored as 6.8, >8.0 stored as 8.2
-- raw_drops and sample_size_ml are NULL (historical PPM-only data)
-- ============================================================
INSERT OR IGNORE INTO test_readings
  (id, session_id, test_type, phase, value_ppm, raw_drops, sample_size_ml, created_at)
VALUES
  -- Session 1: 2025-06-25 | pH 7.1→7.7 | bromine 1.25→6.25
  (1,  1,  'bromine', 'before', 1.25, NULL, NULL, '2025-06-25 10:01:00'),
  (2,  1,  'bromine', 'after',  6.25, NULL, NULL, '2025-06-25 10:02:00'),
  (3,  1,  'ph',      'before', 7.1,  NULL, NULL, '2025-06-25 10:03:00'),
  (4,  1,  'ph',      'after',  7.7,  NULL, NULL, '2025-06-25 10:04:00'),

  -- Session 2: 2025-06-30 | pH 7.0→7.7
  (5,  2,  'ph',      'before', 7.0,  NULL, NULL, '2025-06-30 10:01:00'),
  (6,  2,  'ph',      'after',  7.7,  NULL, NULL, '2025-06-30 10:02:00'),

  -- Session 3: 2025-07-04 | pH 7.3→7.6 | bromine 3.75→7.5 | TA 10→60 | calcium 130→✓
  (7,  3,  'ta',      'before', 10,   NULL, NULL, '2025-07-04 10:01:00'),
  (8,  3,  'ta',      'after',  60,   NULL, NULL, '2025-07-04 10:02:00'),
  (9,  3,  'bromine', 'before', 3.75, NULL, NULL, '2025-07-04 10:03:00'),
  (10, 3,  'bromine', 'after',  7.5,  NULL, NULL, '2025-07-04 10:04:00'),
  (11, 3,  'ph',      'before', 7.3,  NULL, NULL, '2025-07-04 10:05:00'),
  (12, 3,  'ph',      'after',  7.6,  NULL, NULL, '2025-07-04 10:06:00'),
  (13, 3,  'calcium', 'before', 130,  NULL, NULL, '2025-07-04 10:07:00'),
  -- calcium after=✓ → skipped

  -- Session 4: 2025-07-12 | pH 7.5→—
  (14, 4,  'ph',      'before', 7.5,  NULL, NULL, '2025-07-12 10:01:00'),

  -- Session 5: 2025-07-21 | pH 7.2→7.7 | bromine 1.25→7.5 | calcium 120→140
  (15, 5,  'bromine', 'before', 1.25, NULL, NULL, '2025-07-21 10:01:00'),
  (16, 5,  'bromine', 'after',  7.5,  NULL, NULL, '2025-07-21 10:02:00'),
  (17, 5,  'ph',      'before', 7.2,  NULL, NULL, '2025-07-21 10:03:00'),
  (18, 5,  'ph',      'after',  7.7,  NULL, NULL, '2025-07-21 10:04:00'),
  (19, 5,  'calcium', 'before', 120,  NULL, NULL, '2025-07-21 10:05:00'),
  (20, 5,  'calcium', 'after',  140,  NULL, NULL, '2025-07-21 10:06:00'),

  -- Session 6: 2025-07-22 | pH 7.2→—
  (21, 6,  'ph',      'before', 7.2,  NULL, NULL, '2025-07-22 10:01:00'),

  -- Session 7: 2025-08-04 | pH 7.6→✓ | bromine 0.5→8.5 | TA 20→60 | calcium 150→✓
  (22, 7,  'ta',      'before', 20,   NULL, NULL, '2025-08-04 10:01:00'),
  (23, 7,  'ta',      'after',  60,   NULL, NULL, '2025-08-04 10:02:00'),
  (24, 7,  'bromine', 'before', 0.5,  NULL, NULL, '2025-08-04 10:03:00'),
  (25, 7,  'bromine', 'after',  8.5,  NULL, NULL, '2025-08-04 10:04:00'),
  (26, 7,  'ph',      'before', 7.6,  NULL, NULL, '2025-08-04 10:05:00'),
  -- ph after=✓ → skipped
  (27, 7,  'calcium', 'before', 150,  NULL, NULL, '2025-08-04 10:06:00'),
  -- calcium after=✓ → skipped

  -- Session 8: 2025-08-11 | pH 7.6→✓ | bromine 10→✓ | TA 60→✓ | calcium 160→✓
  (28, 8,  'ta',      'before', 60,   NULL, NULL, '2025-08-11 10:01:00'),
  (29, 8,  'bromine', 'before', 10,   NULL, NULL, '2025-08-11 10:02:00'),
  (30, 8,  'ph',      'before', 7.6,  NULL, NULL, '2025-08-11 10:03:00'),
  (31, 8,  'calcium', 'before', 160,  NULL, NULL, '2025-08-11 10:04:00'),

  -- Session 9: 2025-08-16 | pH 7.4→✓ | bromine 5→✓ | TA 50→✓ | calcium 150→✓
  (32, 9,  'ta',      'before', 50,   NULL, NULL, '2025-08-16 10:01:00'),
  (33, 9,  'bromine', 'before', 5,    NULL, NULL, '2025-08-16 10:02:00'),
  (34, 9,  'ph',      'before', 7.4,  NULL, NULL, '2025-08-16 10:03:00'),
  (35, 9,  'calcium', 'before', 150,  NULL, NULL, '2025-08-16 10:04:00'),

  -- Session 10: 2025-08-23 | pH 7.7→✓ | bromine 13→11
  (36, 10, 'bromine', 'before', 13,   NULL, NULL, '2025-08-23 10:01:00'),
  (37, 10, 'bromine', 'after',  11,   NULL, NULL, '2025-08-23 10:02:00'),
  (38, 10, 'ph',      'before', 7.7,  NULL, NULL, '2025-08-23 10:03:00'),
  -- ph after=✓ → skipped

  -- Session 11: 2025-08-24 | pH 7.4→7.6 | bromine 5.5→✓
  (39, 11, 'bromine', 'before', 5.5,  NULL, NULL, '2025-08-24 10:01:00'),
  -- bromine after=✓ → skipped
  (40, 11, 'ph',      'before', 7.4,  NULL, NULL, '2025-08-24 10:02:00'),
  (41, 11, 'ph',      'after',  7.6,  NULL, NULL, '2025-08-24 10:03:00'),

  -- Session 12: 2025-09-03 | pH 7.0→7.5 | bromine 0.5→6.5 | TA 40→70 | calcium 160→✓
  (42, 12, 'ta',      'before', 40,   NULL, NULL, '2025-09-03 10:01:00'),
  (43, 12, 'ta',      'after',  70,   NULL, NULL, '2025-09-03 10:02:00'),
  (44, 12, 'bromine', 'before', 0.5,  NULL, NULL, '2025-09-03 10:03:00'),
  (45, 12, 'bromine', 'after',  6.5,  NULL, NULL, '2025-09-03 10:04:00'),
  (46, 12, 'ph',      'before', 7.0,  NULL, NULL, '2025-09-03 10:05:00'),
  (47, 12, 'ph',      'after',  7.5,  NULL, NULL, '2025-09-03 10:06:00'),
  (48, 12, 'calcium', 'before', 160,  NULL, NULL, '2025-09-03 10:07:00'),
  -- calcium after=✓ → skipped

  -- Session 13: 2025-09-09 | pH 7.7→✓ | bromine 2.5→—
  (49, 13, 'bromine', 'before', 2.5,  NULL, NULL, '2025-09-09 10:01:00'),
  (50, 13, 'ph',      'before', 7.7,  NULL, NULL, '2025-09-09 10:02:00'),
  -- bromine after=— and ph after=✓ → both skipped

  -- Session 14: 2025-09-15 | pH 7.5→✓
  (51, 14, 'ph',      'before', 7.5,  NULL, NULL, '2025-09-15 10:01:00'),
  -- ph after=✓ → skipped

  -- Session 15: 2025-09-23 | pH <7→7.4 (sentinel 6.8)
  (52, 15, 'ph',      'before', 6.8,  NULL, NULL, '2025-09-23 10:01:00'),
  (53, 15, 'ph',      'after',  7.4,  NULL, NULL, '2025-09-23 10:02:00'),

  -- Session 16: 2025-10-04 | pH >8→7.7 (sentinel 8.2) | bromine 16→6.25 | TA 20→60 | calcium 140→✓
  (54, 16, 'ta',      'before', 20,   NULL, NULL, '2025-10-04 10:01:00'),
  (55, 16, 'ta',      'after',  60,   NULL, NULL, '2025-10-04 10:02:00'),
  (56, 16, 'bromine', 'before', 16,   NULL, NULL, '2025-10-04 10:03:00'),
  (57, 16, 'bromine', 'after',  6.25, NULL, NULL, '2025-10-04 10:04:00'),
  (58, 16, 'ph',      'before', 8.2,  NULL, NULL, '2025-10-04 10:05:00'),
  (59, 16, 'ph',      'after',  7.7,  NULL, NULL, '2025-10-04 10:06:00'),
  (60, 16, 'calcium', 'before', 140,  NULL, NULL, '2025-10-04 10:07:00'),
  -- calcium after=✓ → skipped

  -- Session 17: 2025-10-10 | pH 7.1→7.6 | bromine 4.5→—
  (61, 17, 'bromine', 'before', 4.5,  NULL, NULL, '2025-10-10 10:01:00'),
  (62, 17, 'ph',      'before', 7.1,  NULL, NULL, '2025-10-10 10:02:00'),
  (63, 17, 'ph',      'after',  7.6,  NULL, NULL, '2025-10-10 10:03:00'),

  -- Session 18: 2025-10-18 | pH 7.4→7.6 | bromine 2→8.5
  (64, 18, 'bromine', 'before', 2,    NULL, NULL, '2025-10-18 10:01:00'),
  (65, 18, 'bromine', 'after',  8.5,  NULL, NULL, '2025-10-18 10:02:00'),
  (66, 18, 'ph',      'before', 7.4,  NULL, NULL, '2025-10-18 10:03:00'),
  (67, 18, 'ph',      'after',  7.6,  NULL, NULL, '2025-10-18 10:04:00'),

  -- Session 19: 2025-11-03 | pH <7→7.4 (6.8) | bromine 12.5→12
  (68, 19, 'bromine', 'before', 12.5, NULL, NULL, '2025-11-03 10:01:00'),
  (69, 19, 'bromine', 'after',  12,   NULL, NULL, '2025-11-03 10:02:00'),
  (70, 19, 'ph',      'before', 6.8,  NULL, NULL, '2025-11-03 10:03:00'),
  (71, 19, 'ph',      'after',  7.4,  NULL, NULL, '2025-11-03 10:04:00'),

  -- Session 20: 2025-11-08 (post drain/refill) | pH 7.8→7.5 | bromine —→5.5 | TA 30→60 | calcium —→140
  (72, 20, 'ta',      'before', 30,   NULL, NULL, '2025-11-08 10:01:00'),
  (73, 20, 'ta',      'after',  60,   NULL, NULL, '2025-11-08 10:02:00'),
  (74, 20, 'bromine', 'after',  5.5,  NULL, NULL, '2025-11-08 10:03:00'),
  -- bromine before=— (fresh water after drain/refill, no before reading)
  (75, 20, 'ph',      'before', 7.8,  NULL, NULL, '2025-11-08 10:04:00'),
  (76, 20, 'ph',      'after',  7.5,  NULL, NULL, '2025-11-08 10:05:00'),
  (77, 20, 'calcium', 'after',  140,  NULL, NULL, '2025-11-08 10:06:00'),
  -- calcium before=— (fresh water after drain/refill, no before reading)

  -- Session 21: 2025-11-16 | pH >8→7.4 (8.2) | bromine 9.5→✓
  (78, 21, 'bromine', 'before', 9.5,  NULL, NULL, '2025-11-16 10:01:00'),
  -- bromine after=✓ → skipped
  (79, 21, 'ph',      'before', 8.2,  NULL, NULL, '2025-11-16 10:02:00'),
  (80, 21, 'ph',      'after',  7.4,  NULL, NULL, '2025-11-16 10:03:00'),

  -- Session 22: 2025-11-26 | pH 7.5→— | bromine 8.5→✓
  (81, 22, 'bromine', 'before', 8.5,  NULL, NULL, '2025-11-26 10:01:00'),
  -- bromine after=✓ → skipped
  (82, 22, 'ph',      'before', 7.5,  NULL, NULL, '2025-11-26 10:02:00'),
  -- ph after=— → skipped

  -- Session 23: 2025-12-03 | pH <7.0→7.5 (6.8)
  (83, 23, 'ph',      'before', 6.8,  NULL, NULL, '2025-12-03 10:01:00'),
  (84, 23, 'ph',      'after',  7.5,  NULL, NULL, '2025-12-03 10:02:00'),

  -- Session 24: 2025-12-10 | pH 7.1→7.5 | bromine 9.5→✓
  (85, 24, 'bromine', 'before', 9.5,  NULL, NULL, '2025-12-10 10:01:00'),
  -- bromine after=✓ → skipped
  (86, 24, 'ph',      'before', 7.1,  NULL, NULL, '2025-12-10 10:02:00'),
  (87, 24, 'ph',      'after',  7.5,  NULL, NULL, '2025-12-10 10:03:00'),

  -- Session 25: 2025-12-14 | pH <7→7.6 (6.8) | bromine 7→✓ | TA 30→60
  (88, 25, 'ta',      'before', 30,   NULL, NULL, '2025-12-14 10:01:00'),
  (89, 25, 'ta',      'after',  60,   NULL, NULL, '2025-12-14 10:02:00'),
  (90, 25, 'bromine', 'before', 7,    NULL, NULL, '2025-12-14 10:03:00'),
  -- bromine after=✓ → skipped
  (91, 25, 'ph',      'before', 6.8,  NULL, NULL, '2025-12-14 10:04:00'),
  (92, 25, 'ph',      'after',  7.6,  NULL, NULL, '2025-12-14 10:05:00'),

  -- Session 26: 2025-12-31 | pH 7.5→—
  (93, 26, 'ph',      'before', 7.5,  NULL, NULL, '2025-12-31 10:01:00'),

  -- Session 27: 2026-01-07 | pH 7.3→7.7 | bromine 5.5→—
  (94, 27, 'bromine', 'before', 5.5,  NULL, NULL, '2026-01-07 10:01:00'),
  -- bromine after=— → skipped
  (95, 27, 'ph',      'before', 7.3,  NULL, NULL, '2026-01-07 10:02:00'),
  (96, 27, 'ph',      'after',  7.7,  NULL, NULL, '2026-01-07 10:03:00'),

  -- Session 28: 2026-01-13 | pH 8.0→— | bromine 12.5→—
  -- Note: 8.0 is a valid slider stop (not the >8.0 sentinel 8.2)
  (97, 28, 'bromine', 'before', 12.5, NULL, NULL, '2026-01-13 10:01:00'),
  (98, 28, 'ph',      'before', 8.0,  NULL, NULL, '2026-01-13 10:02:00'),
  -- both afters=— → skipped

  -- Session 29: 2026-01-22 | pH <7→7.7 (6.8) | bromine 12.5→—
  (99,  29, 'bromine', 'before', 12.5, NULL, NULL, '2026-01-22 10:01:00'),
  -- bromine after=— → skipped
  (100, 29, 'ph',      'before', 6.8,  NULL, NULL, '2026-01-22 10:02:00'),
  (101, 29, 'ph',      'after',  7.7,  NULL, NULL, '2026-01-22 10:03:00'),

  -- Session 30: 2026-02-01 | pH <7→7.4 (6.8)
  (102, 30, 'ph',      'before', 6.8,  NULL, NULL, '2026-02-01 10:01:00'),
  (103, 30, 'ph',      'after',  7.4,  NULL, NULL, '2026-02-01 10:02:00'),

  -- Session 31: 2026-02-08 | pH <7→7.7 (6.8) | bromine 9.5→✓ | TA 30→60 | calcium 130→✓
  (104, 31, 'ta',      'before', 30,   NULL, NULL, '2026-02-08 10:01:00'),
  (105, 31, 'ta',      'after',  60,   NULL, NULL, '2026-02-08 10:02:00'),
  (106, 31, 'bromine', 'before', 9.5,  NULL, NULL, '2026-02-08 10:03:00'),
  -- bromine after=✓ → skipped
  (107, 31, 'ph',      'before', 6.8,  NULL, NULL, '2026-02-08 10:04:00'),
  (108, 31, 'ph',      'after',  7.7,  NULL, NULL, '2026-02-08 10:05:00'),
  (109, 31, 'calcium', 'before', 130,  NULL, NULL, '2026-02-08 10:06:00'),
  -- calcium after=✓ → skipped

  -- Session 32: 2026-02-15 | pH 7.5→— | bromine 0→—
  (110, 32, 'bromine', 'before', 0,    NULL, NULL, '2026-02-15 10:01:00'),
  (111, 32, 'ph',      'before', 7.5,  NULL, NULL, '2026-02-15 10:02:00');
  -- both afters=— → skipped
