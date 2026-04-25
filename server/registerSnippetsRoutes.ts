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

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const getSnippetBaseQuery = (userId: string | null) =>
  `SELECT * FROM code_snippets WHERE (user_id = 'system' ${userId ? "OR user_id = ?" : ""})`;

class SnippetQueryBuilder {
  private conditions: string[] = [];
  private params: string[] = [];

  withLanguage(language: string | null) {
    if (language) {
      this.conditions.push("language = ?");
      this.params.push(language);
    }
    return this;
  }

  withTag(tag: string | null) {
    if (tag) {
      this.conditions.push("tags LIKE ?");
      this.params.push(`%"${tag}"%`);
    }
    return this;
  }

  withSearch(search: string | null) {
    if (search) {
      this.conditions.push("(title LIKE ? OR code LIKE ? OR description LIKE ?)");
      const pattern = `%${search}%`;
      this.params.push(pattern, pattern, pattern);
    }
    return this;
  }

  build(): SnippetFilterResult {
    return { conditions: this.conditions, params: this.params };
  }
}

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

class SnippetUpdateBuilder {
  private updates: string[] = [];
  private params: string[] = [];

  withField(field: string, value: string | undefined) {
    if (value !== undefined) {
      this.updates.push(`${field} = ?`);
      this.params.push(value);
    }
    return this;
  }

  withTags(tags: string[] | undefined) {
    if (tags !== undefined) {
      this.updates.push("tags = ?");
      this.params.push(JSON.stringify(tags));
    }
    return this;
  }

  build() {
    return { updates: this.updates, params: this.params };
  }
}

const syncLinkedShares = async (
  c: AppContext,
  userId: string,
  snippetId: string,
  snippet: { title: string; code: string },
) => {
  await c.env.DB.prepare(
    `UPDATE shares
     SET content = ?, name = ?, updated_at = datetime("now")
     WHERE user_id = ? AND source_type = 'snippet' AND source_id = ?`,
  )
    .bind(snippet.code, snippet.title || "代码片段分享", userId, snippetId)
    .run();
};

const executeSnippetUpdate = async (
  c: AppContext,
  id: string,
  userId: string,
  body: SnippetUpdateBody,
  existing: SnippetRow,
) => {
  if (await applyCopyCountDelta(c, body, id)) return { success: true };
  if (existing.user_id !== userId) return { error: "Forbidden", status: 403 };

  const snippetUpdates = new SnippetUpdateBuilder()
    .withField("title", body.title)
    .withField("code", body.code)
    .withField("language", body.language)
    .withField("description", body.description)
    .withTags(body.tags)
    .build();

  if (snippetUpdates.updates.length > 0) {
    snippetUpdates.updates.push('updated_at = datetime("now")');
    const sql = `UPDATE code_snippets SET ${snippetUpdates.updates.join(", ")} WHERE id = ? AND user_id = ?`;
    await c.env.DB.prepare(sql)
      .bind(...snippetUpdates.params, id, userId)
      .run();
  }

  const updated = await c.env.DB.prepare("SELECT * FROM code_snippets WHERE id = ?").bind(id).first<SnippetRow>();
  if (!updated) return { error: "Failed to update snippet", status: 500 };

  await syncLinkedShares(c, userId, id, {
    title: updated.title || body.title || "",
    code: updated.code || body.code || "",
  });

  return { success: true, data: parseSnippetRow(updated) };
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

const registerSnippetCrudRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/snippets", async (c) => {
    const userId = await getUserFromSession(c);
    const url = new URL(c.req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 2000);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const filters = new SnippetQueryBuilder()
      .withLanguage(url.searchParams.get("language"))
      .withSearch(url.searchParams.get("search"))
      .withTag(url.searchParams.get("tag"))
      .build();

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
      if (!newSnippet) return c.json({ error: "Failed to create snippet" }, 500);
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
      const existing = await c.env.DB.prepare("SELECT * FROM code_snippets WHERE id = ?").bind(id).first<SnippetRow>();

      if (!existing) return c.json({ error: "Snippet not found" }, 404);

      const result = await executeSnippetUpdate(c, id, userId, body, existing);
      if ("error" in result) {
        return c.json({ error: result.error }, (result.status as 403 | 500) || 500);
      }

      return c.json(result.data || { success: true });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });

  app.delete("/api/snippets/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const result = await c.env.DB.prepare("DELETE FROM code_snippets WHERE id = ? AND user_id = ?")
        .bind(c.req.param("id"), userId)
        .run();
      if (result.meta.changes === 0) return c.json({ error: "Snippet not found or unauthorized" }, 404);
      return c.json({ success: true });
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });
};

const registerSnippetMetadataRoutes = (app: Hono<{ Bindings: Bindings }>) => {
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

export const registerSnippetsRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  registerSnippetCrudRoutes(app);
  registerSnippetMetadataRoutes(app);
};
