PRAGMA defer_foreign_keys = on;

ALTER TABLE sessions RENAME TO sessions_legacy;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO sessions (id, user_id, expires_at)
SELECT id, user_id, expires_at
FROM sessions_legacy;

DROP TABLE sessions_legacy;
