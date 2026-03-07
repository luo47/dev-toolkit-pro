CREATE TABLE IF NOT EXISTS code_snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, -- 'system' for public, or github user id
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT DEFAULT 'plaintext',
  description TEXT,
  tags TEXT, -- JSON array
  copy_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_code_snippets_user ON code_snippets(user_id);
CREATE INDEX IF NOT EXISTS idx_code_snippets_language ON code_snippets(language);

CREATE VIRTUAL TABLE IF NOT EXISTS code_snippets_fts USING fts5(title, code, description, content='code_snippets', content_rowid='id');
