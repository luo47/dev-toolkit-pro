import type { Hono } from "hono";
import type { Bindings } from "./serverTypes";
import { getUserFromSession } from "./serverUtils";

type SearchEngineRow = {
  id: string;
  name: string;
  icon: string | null;
  url_template: string;
  is_visible: number;
  sort_order: number;
};

type SearchEngineInput = {
  id?: string;
  name: string;
  icon?: string | null;
  url_template: string;
  is_visible: boolean;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const registerSearchEngineRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/search_engines", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: true, data: [] });

    try {
      const result = await c.env.DB.prepare(
        "SELECT * FROM search_engines WHERE user_id = ? ORDER BY sort_order ASC",
      )
        .bind(userId)
        .all<SearchEngineRow>();
      return c.json({
        success: true,
        data: result.results.map((row) => ({
          id: row.id,
          name: row.name,
          icon: row.icon,
          url_template: row.url_template,
          is_visible: row.is_visible === 1,
          sort_order: row.sort_order,
        })),
      });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });

  app.post("/api/search_engines/batch", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const payload = (await c.req.json()) as { engines?: SearchEngineInput[] };
      const { engines } = payload;
      if (!Array.isArray(engines)) return c.json({ error: "Invalid data format" }, 400);

      const statements: D1PreparedStatement[] = [
        c.env.DB.prepare("DELETE FROM search_engines WHERE user_id = ?").bind(userId),
      ];
      const insertStatement = c.env.DB.prepare(
        "INSERT INTO search_engines (id, user_id, name, icon, url_template, is_visible, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );

      engines.forEach((engine, index) => {
        statements.push(
          insertStatement.bind(
            engine.id || crypto.randomUUID(),
            userId,
            engine.name,
            engine.icon || null,
            engine.url_template,
            engine.is_visible ? 1 : 0,
            index,
          ),
        );
      });

      await c.env.DB.batch(statements);
      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Database error") }, 500);
    }
  });
};
