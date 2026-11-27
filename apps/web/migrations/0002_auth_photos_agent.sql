-- Phase 1: sign-in (Better Auth tables), the email allowlist, photos, and
-- sync-agent tokens. Timestamps are milliseconds since the Unix epoch.
-- Status and role values are checked in code (Zod), not with CHECK
-- constraints, so later phases can add values without rebuilding tables.

-- Better Auth core tables (model names mapped in src/lib/server/auth.ts).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX accounts_user_id_idx ON accounts (user_id);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX verifications_identifier_idx ON verifications (identifier);

-- Google accounts allowed to sign in. Rows are added with wrangler, never
-- committed, so no email address lives in the repo. role: admin | member.
CREATE TABLE allowed_emails (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- One row per photo. sha256 is unique, so the same photo is never stored twice.
-- original_in_cloud = 1 while the original is in the R2 inbox (it counts
-- toward the inbox cap until Phase 2 deletes it after a backup).
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users (id),
  status TEXT NOT NULL,
  original_in_cloud INTEGER NOT NULL DEFAULT 0,
  drive_path TEXT,
  taken_at INTEGER,
  created_at INTEGER NOT NULL,
  uploaded_at INTEGER,
  archived_at INTEGER
);
CREATE INDEX photos_status_idx ON photos (status, uploaded_at);

-- Sync agent credentials. Only a SHA-256 hash of each token is stored.
CREATE TABLE agent_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);

UPDATE app_meta SET value = '2' WHERE key = 'schema_version';
