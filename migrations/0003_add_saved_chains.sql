-- 创建 chain_contents 表，保证相同的处理链内容只存储一份
CREATE TABLE IF NOT EXISTS chain_contents (
  md5 TEXT PRIMARY KEY,
  steps_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 创建 saved_chains 表
CREATE TABLE IF NOT EXISTS saved_chains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content_md5 TEXT NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (content_md5) REFERENCES chain_contents(md5) ON DELETE CASCADE,
  UNIQUE(user_id, content_md5)
);

-- 插入系统用户 (如果不存在)
INSERT INTO users (id, github_id, username, name, avatar_url)
VALUES ('system', 0, 'system', 'System Built-in', '')
ON CONFLICT(github_id) DO NOTHING;

-- 插入默认处理链内容
INSERT INTO chain_contents (md5, steps_json, created_at)
VALUES (
  'md5-proxy-converter',
  '[{"id":"step-1","type":"jsonpath","value":"$.data.free_ip_list || $.data.page.list || $","active":true},{"id":"step-2","type":"js","value":"if (!Array.isArray(input)) return \"错误：输入不是有效的数组。请检查 JSONPath 提取结果。\";\n\nreturn input.map(item => {\n  // 格式化：socks://base64(user:pass)@ip:port#city-ip\n  const auth = btoa(`${item.username}:${item.password}`);\n  const city = (item.city || ''Unknown'').replace(/\\s+/g, '''');\n  return `socks://${auth}@${item.ip}:${item.port}#${city}-${item.ip}`;\n}).join(''\\n'');","active":true}]',
  1710000000000
) ON CONFLICT DO NOTHING;

INSERT INTO chain_contents (md5, steps_json, created_at)
VALUES (
  'md5-smb-converter',
  '[{"id":"smb-step-1","type":"js","value":"// SMB 路径双向转换脚本\nconst lines = input.split(''\\n'').filter(line => line.trim());\n\nreturn lines.map(line => {\n  const clean = line.trim();\n  \n  // Windows -> URI (\\\\\\\\server\\\\share)\n  if (clean.startsWith(''\\\\\\\\\\\\\\\\'')) {\n    const parts = clean.substring(2).split(''\\\\\\\\'');\n    return ''smb://'' + parts.map(p => encodeURIComponent(p)).join(''/'');\n  }\n  \n  // URI -> Windows (smb://server/share)\n  if (clean.toLowerCase().startsWith(''smb://'')) {\n    try {\n      const url = new URL(clean.replace(/^smb:/i, ''http:''));\n      let winPath = ''\\\\\\\\\\\\\\\\'' + url.hostname;\n      const pathname = decodeURIComponent(url.pathname);\n      if (pathname && pathname !== ''/'') {\n        winPath += pathname.replace(/\\//g, ''\\\\\\\\'');\n      }\n      return winPath;\n    } catch (e) {\n      const parts = clean.substring(6).split(''/'');\n      return ''\\\\\\\\\\\\\\\\'' + parts.join(''\\\\\\\\'');\n    }\n  }\n  \n  return clean;\n}).join(''\\n'');","active":true}]',
  1710000000001
) ON CONFLICT DO NOTHING;

INSERT INTO chain_contents (md5, steps_json, created_at)
VALUES (
  'md5-proxy-link-converter',
  '[{"id":"proxy-link-step-1","type":"js","value":"// 代理链接转换脚本\nconst line = input.trim();\nif (!line) return \"\";\n\ntry {\n  let user = '''', pass = '''', host = '''', port = '''', name = ''NAME'';\n\n  // 格式 3: socks://base64(user:pass@host:port)?remarks=NAME\n  if (line.includes(''?remarks='')) {\n    const parts = line.split(''?remarks='');\n    name = decodeURIComponent(parts[1]);\n    const base64Part = parts[0].replace(/^socks5?:\\/\\//, '''');\n    const decoded = atob(base64Part);\n    const match = decoded.match(/^([^:]+):([^@]+)@([^:]+):(.+)$/);\n    if (match) [, user, pass, host, port] = match;\n  } \n  // 格式 1: socks5://host:port:user:pass\n  else if (line.match(/^socks5?:\\/\\/([^:]+):([^:]+):([^:]+):(.+)$/)) {\n    const match = line.match(/^socks5?:\\/\\/([^:]+):([^:]+):([^:]+):(.+)$/);\n    if (match) [, host, port, user, pass] = match;\n  }\n  // 格式 2: socks5://user:pass@host:port\n  else if (line.match(/^socks5?:\\/\\/([^:]+):([^@]+)@([^:]+):(.+)$/)) {\n    const match = line.match(/^socks5?:\\/\\/([^:]+):([^@]+)@([^:]+):(.+)$/);\n    if (match) [, user, pass, host, port] = match;\n  }\n\n  if (user && pass && host && port) {\n    const userPassBase64 = btoa(`${user}:${pass}`);\n    return `socks://${userPassBase64}@${host}:${port}#${encodeURIComponent(name)}`;\n  }\n  return \"错误：无法识别的链接格式\";\n} catch (e) {\n  return \"错误：解析链接失败 - \" + e.message;\n}","active":true}]',
  1710000000002
) ON CONFLICT DO NOTHING;

-- 插入系统用户的处理链记录
INSERT INTO saved_chains (id, user_id, name, content_md5, is_favorite, created_at)
VALUES (
  'default-proxy-converter',
  'system',
  '代理列表转换 (Proxy Converter)',
  'md5-proxy-converter',
  1,
  1710000000000
) ON CONFLICT DO NOTHING;

INSERT INTO saved_chains (id, user_id, name, content_md5, is_favorite, created_at)
VALUES (
  'default-smb-converter',
  'system',
  'SMB 路径互转 (SMB Path Converter)',
  'md5-smb-converter',
  1,
  1710000000001
) ON CONFLICT DO NOTHING;

INSERT INTO saved_chains (id, user_id, name, content_md5, is_favorite, created_at)
VALUES (
  'default-proxy-link-converter',
  'system',
  '代理链接转换 (Proxy Link Converter)',
  'md5-proxy-link-converter',
  1,
  1710000000002
) ON CONFLICT DO NOTHING;
