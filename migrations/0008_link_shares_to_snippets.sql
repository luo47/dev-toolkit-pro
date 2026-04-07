ALTER TABLE shares ADD COLUMN source_type TEXT;
ALTER TABLE shares ADD COLUMN source_id TEXT;

CREATE INDEX IF NOT EXISTS idx_shares_source ON shares(source_type, source_id);
