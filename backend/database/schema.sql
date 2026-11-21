-- Creates persistent StudentSetu records and relationship constraints.
-- Stores accounts, listings, requests, and tutoring bookings.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  branch TEXT NOT NULL,
  year INTEGER NOT NULL CHECK(year BETWEEN 1 AND 4),
  password_hash TEXT NOT NULL,
  teaches TEXT NOT NULL,
  wants TEXT NOT NULL DEFAULT '',
  free_time TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0,
  otp_hash TEXT,
  otp_expires INTEGER,
  otp_sent INTEGER,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES students(id),
  kind TEXT NOT NULL CHECK(kind IN ('item','teach')),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'sell',
  price INTEGER NOT NULL DEFAULT 0,
  wants TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES students(id),
  receiver_id INTEGER NOT NULL REFERENCES students(id),
  kind TEXT NOT NULL,
  listing_id INTEGER REFERENCES listings(id),
  offer_id INTEGER REFERENCES listings(id),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS waitlists (
  item_id INTEGER NOT NULL REFERENCES listings(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(item_id,student_id)
);
CREATE TABLE IF NOT EXISTS circles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES students(id),
  skill TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
);
CREATE TABLE IF NOT EXISTS circle_members (
  circle_id INTEGER NOT NULL REFERENCES circles(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  answer TEXT NOT NULL DEFAULT 'waiting',
  member_order INTEGER NOT NULL,
  PRIMARY KEY(circle_id,student_id)
);
CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id),
  reviewer_id INTEGER NOT NULL REFERENCES students(id),
  target_id INTEGER NOT NULL REFERENCES students(id),
  stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
  UNIQUE(request_id,reviewer_id)
);
CREATE TABLE IF NOT EXISTS completion_confirmations (
  request_id INTEGER NOT NULL REFERENCES requests(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  PRIMARY KEY(request_id,student_id)
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES students(id),
  learner_id INTEGER NOT NULL REFERENCES students(id),
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_listing_active ON listings(kind,active);
CREATE INDEX IF NOT EXISTS idx_request_owner ON requests(receiver_id,status);
