-- Phase 0: a single key/value table so the health check can confirm that
-- migrations have been applied. Real tables arrive in Phase 1.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '1');
