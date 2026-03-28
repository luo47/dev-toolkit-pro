import type { Hono } from "hono";
import type { Bindings } from "./serverTypes";
import { getUserFromSession } from "./serverUtils";

export const registerSearchEngineRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/search_engines", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: true, data: [] });

    try {
      const result = await c.env.DB.prepare(
        "SELECT * FROM search_engines WHERE user_id = ? ORDER BY sort_order ASC",
      )
        .bind(userId)
        .all();
      return c.json({
        success: true,
        data: result.results.map((row: any) => ({
          id: row.id,
          name: row.name,
          icon: row.icon,
          url_template: row.url_template,
          is_visible: row.is_visible === 1,
          sort_order: row.sort_order,
        })),
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Database error" }, 500);
    }
  });

  app.post("/api/search_engines/batch", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const { engines } = await c.req.json();
      if (!Array.isArray(engines)) return c.json({ error: "Invalid data format" }, 400);

      const statements: any[] = [
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
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Database error" }, 500);
    }
  });
};
