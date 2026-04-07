PRAGMA defer_foreign_keys = on;

ALTER TABLE users RENAME TO users_legacy;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

INSERT INTO users (id, provider, provider_user_id, username, name, avatar_url, created_at)
SELECT id, 'github', CAST(github_id AS TEXT), username, name, avatar_url, created_at
FROM users_legacy;

DROP TABLE users_legacy;

CREATE INDEX IF NOT EXISTS idx_users_provider_lookup ON users(provider, provider_user_id);
