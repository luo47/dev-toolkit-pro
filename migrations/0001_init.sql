-- 工具使用统计表
CREATE TABLE IF NOT EXISTS tool_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 预设初始数据
INSERT INTO tool_usage (tool_name, count) VALUES
  ('json-formatter', 0),
  ('base64-encoder', 0),
  ('proxy-converter', 0),
  ('json-to-csv', 0),
  ('qrcode', 0);
