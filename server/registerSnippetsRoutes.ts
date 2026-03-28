import type { Hono } from "hono";
import type { AppContext, Bindings } from "./serverTypes";
import { getUserFromSession } from "./serverUtils";

type SnippetRow = {
  id: string;
  user_id: string | null;
  title: string;
  code: string;
  language: string | null;
  description: string | null;
  tags: string | null;
  copy_count: number;
  created_at: string;
  updated_at: string;
};

type SnippetFilterResult = {
  conditions: string[];
  params: Array<string>;
};

type SnippetUpdateBody = {
  title?: string;
  code?: string;
  language?: string;
  description?: string;
  tags?: string[];
  copyCountsDelta?: Record<string, number>;
};

type SnippetCreateBody = {
  title?: string;
  code?: string;
  language?: string;
  description?: string;
  tags?: string[];
};

type CountRow = {
  total: number;
};

type LanguageCountRow = {
  language: string | null;
  count: number;
};

type TagRow = {
  tags: string | null;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getSnippetBaseQuery = (userId: string | null) =>
  `SELECT * FROM code_snippets WHERE (user_id = 'system' ${userId ? "OR user_id = ?" : ""})`;

const buildSnippetFilters = ({
  language,
  search,
  tag,
}: {
  language: string | null;
  search: string | null;
  tag: string | null;
}): SnippetFilterResult => {
  const conditions: string[] = [];
  const params: string[] = [];
  if (language) {
    conditions.push("language = ?");
    params.push(language);
  }
  if (tag) {
    conditions.push("tags LIKE ?");
    params.push(`%"${tag}"%`);
  }
  if (search) {
    conditions.push("(title LIKE ? OR code LIKE ? OR description LIKE ?)");
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  return { conditions, params };
};

const applySortAndPaging = (query: string, sort: string, order: string) => {
  const validSorts = ["copy_count", "updated_at", "created_at", "title"];
  const sortColumn = validSorts.includes(sort) ? sort : "updated_at";
  const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";
  if (sortColumn === "title") {
    return `${query} ORDER BY (CASE WHEN title IS NULL OR title = '' THEN 1 ELSE 0 END) ASC, title ${sortOrder} LIMIT ? OFFSET ?`;
  }
  return `${query} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
};

const parseSnippetRow = (row: SnippetRow) => ({
  ...row,
  tags: row.tags ? JSON.parse(row.tags) : [],
});

const buildSnippetUpdates = (body: SnippetUpdateBody) => {
  const updates: string[] = [];
  const params: Array<string> = [];
  [
    ["title", body.title],
    ["code", body.code],
    ["language", body.language],
    ["description", body.description],
  ].forEach(([field, value]) => {
    if (value !== undefined) {
      updates.push(`${field} = ?`);
      params.push(value);
    }
  });
  if (body.tags !== undefined) {
    updates.push("tags = ?");
    params.push(JSON.stringify(body.tags));
  }
  return { params, updates };
};

const getSnippetListPayload = async (
  c: AppContext,
  userId: string | null,
  filters: SnippetFilterResult,
  sort: string,
  order: string,
  limit: number,
  offset: number,
) => {
  const params = userId ? [userId, ...filters.params] : [...filters.params];
  let query = getSnippetBaseQuery(userId);
  if (filters.conditions.length > 0) query += ` AND ${filters.conditions.join(" AND ")}`;

  const result = await c.env.DB.prepare(applySortAndPaging(query, sort, order))
    .bind(...params, limit, offset)
    .all<SnippetRow>();

  let countQuery = `SELECT COUNT(*) as total FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? "OR user_id = ?" : ""})`;
  if (filters.conditions.length > 0) countQuery += ` AND ${filters.conditions.join(" AND ")}`;
  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...params)
    .first<CountRow>();

  return {
    snippets: result.results.map(parseSnippetRow),
    total: countResult ? countResult.total : 0,
    limit,
    offset,
  };
};

const applyCopyCountDelta = async (c: AppContext, body: SnippetUpdateBody, id: string) => {
  if (!body.copyCountsDelta?.[id]) return false;
  await c.env.DB.prepare("UPDATE code_snippets SET copy_count = copy_count + ? WHERE id = ?")
    .bind(body.copyCountsDelta[id], id)
    .run();
  return body.title === undefined && body.code === undefined;
};

export const registerSnippetsRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/snippets", async (c) => {
    const userId = await getUserFromSession(c);
    const url = new URL(c.req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const filters = buildSnippetFilters({
      language: url.searchParams.get("language"),
      search: url.searchParams.get("search"),
      tag: url.searchParams.get("tag"),
    });

    try {
      return c.json(
        await getSnippetListPayload(
          c,
          userId,
          filters,
          url.searchParams.get("sort") || "updated_at",
          url.searchParams.get("order") || "desc",
          limit,
          offset,
        ),
      );
    } catch (error) {
      console.error("Fetch snippets err:", error);
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });

  app.get("/api/snippets/:id", async (c) => {
    const userId = await getUserFromSession(c);
    try {
      const sql = `SELECT * FROM code_snippets WHERE id = ? AND (user_id = 'system' OR user_id IS NULL ${userId ? "OR user_id = ?" : ""})`;
      const statement = userId
        ? c.env.DB.prepare(sql).bind(c.req.param("id"), userId)
        : c.env.DB.prepare(sql).bind(c.req.param("id"));
      const result = await statement.first<SnippetRow>();
      if (!result) return c.json({ error: "Snippet not found" }, 404);
      return c.json(parseSnippetRow(result));
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });

  app.post("/api/snippets", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const {
        title = "",
        code,
        language = "",
        description = "",
        tags = [],
      } = (await c.req.json()) as SnippetCreateBody;
      if (!code) return c.json({ error: "Code is required" }, 400);

      const result = await c.env.DB.prepare(
        'INSERT INTO code_snippets (user_id, title, code, language, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))',
      )
        .bind(userId, title, code, language, description, JSON.stringify(tags))
        .run();

      const newSnippet = await c.env.DB.prepare("SELECT * FROM code_snippets WHERE id = ?")
        .bind(result.meta.last_row_id)
        .first<SnippetRow>();
      return c.json(parseSnippetRow(newSnippet), 201);
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });

  app.put("/api/snippets/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    try {
      const body = (await c.req.json()) as SnippetUpdateBody;
      const existing = await c.env.DB.prepare("SELECT * FROM code_snippets WHERE id = ?")
        .bind(id)
        .first<SnippetRow>();
      if (!existing) return c.json({ error: "Snippet not found" }, 404);

      if (await applyCopyCountDelta(c, body, id)) return c.json({ success: true });
      if (existing.user_id !== userId) return c.json({ error: "Forbidden" }, 403);

      const snippetUpdates = buildSnippetUpdates(body);
      if (snippetUpdates.updates.length > 0) {
        snippetUpdates.updates.push('updated_at = datetime("now")');
        await c.env.DB.prepare(
          `UPDATE code_snippets SET ${snippetUpdates.updates.join(", ")} WHERE id = ? AND user_id = ?`,
        )
          .bind(...snippetUpdates.params, id, userId)
          .run();
      }

      const updated = await c.env.DB.prepare("SELECT * FROM code_snippets WHERE id = ?")
        .bind(id)
        .first<SnippetRow>();
      return c.json(parseSnippetRow(updated));
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });

  app.delete("/api/snippets/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const result = await c.env.DB.prepare(
        "DELETE FROM code_snippets WHERE id = ? AND user_id = ?",
      )
        .bind(c.req.param("id"), userId)
        .run();
      if (result.meta.changes === 0)
        return c.json({ error: "Snippet not found or unauthorized" }, 404);
      return c.json({ success: true });
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });

  app.get("/api/snippets/data/languages", async (c) => {
    const userId = await getUserFromSession(c);
    try {
      const sql = `SELECT DISTINCT language, COUNT(*) as count FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? "OR user_id = ?" : ""}) AND language IS NOT NULL GROUP BY language ORDER BY count DESC`;
      const statement = userId ? c.env.DB.prepare(sql).bind(userId) : c.env.DB.prepare(sql);
      const result = await statement.all<LanguageCountRow>();
      return c.json(result.results);
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });

  app.get("/api/snippets/data/tags", async (c) => {
    const userId = await getUserFromSession(c);
    try {
      const sql = `SELECT tags FROM code_snippets WHERE (user_id = 'system' OR user_id IS NULL ${userId ? "OR user_id = ?" : ""})`;
      const statement = userId ? c.env.DB.prepare(sql).bind(userId) : c.env.DB.prepare(sql);
      const result = await statement.all<TagRow>();
      const tagCounts: Record<string, number> = {};
      result.results.forEach((row) => {
        if (!row.tags) return;
        JSON.parse(row.tags).forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      return c.json(
        Object.entries(tagCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      );
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });
};
