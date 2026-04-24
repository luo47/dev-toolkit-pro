-- 为 shares 表添加修改密钥字段
ALTER TABLE shares ADD COLUMN edit_token TEXT;
CREATE INDEX IF NOT EXISTS idx_shares_edit_token ON shares(edit_token);
