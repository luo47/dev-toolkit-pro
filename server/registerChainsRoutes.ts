import type { Hono } from "hono";
import type { Bindings } from "./serverTypes";
import { getUserFromSession } from "./serverUtils";

export const registerChainsRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/chains", async (c) => {
    const userId = await getUserFromSession(c);

    try {
      const params: any[] = [];
      let query = `
        SELECT sc.id, sc.name, sc.is_favorite as isFavorite, sc.created_at as createdAt, cc.steps_json as steps
        FROM saved_chains sc
        JOIN chain_contents cc ON sc.content_md5 = cc.md5
        WHERE sc.user_id = 'system'
      `;

      if (userId) {
        query = `
          SELECT sc.id, sc.name, sc.is_favorite as isFavorite, sc.created_at as createdAt, cc.steps_json as steps
          FROM saved_chains sc
          JOIN chain_contents cc ON sc.content_md5 = cc.md5
          WHERE sc.user_id = 'system' OR sc.user_id = ?
        `;
        params.push(userId);
      }

      const result = await c.env.DB.prepare(query)
        .bind(...params)
        .all();

      return c.json({
        success: true,
        data: result.results.map((row: any) => ({
          ...row,
          isFavorite: !!row.isFavorite,
          steps: JSON.parse(row.steps),
        })),
      });
    } catch (error: any) {
      console.error("Fetch chains err:", error);
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });

  app.post("/api/chains", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const body = await c.req.json();
      const { name, steps } = body;
      if (!name || !steps || !Array.isArray(steps))
        return c.json({ error: "无效的处理链数据" }, 400);
      if (name.length > 100) return c.json({ error: "名称过长" }, 400);
      if (steps.length > 50) return c.json({ error: "处理步骤过多" }, 400);

      const stepsJson = JSON.stringify(steps);
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stepsJson));
      const contentMd5 = Array.from(new Uint8Array(hashBuffer))
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");

      await c.env.DB.prepare(
        `INSERT INTO chain_contents (md5, steps_json, created_at) VALUES (?, ?, ?) ON CONFLICT(md5) DO NOTHING`,
      )
        .bind(contentMd5, stepsJson, Date.now())
        .run();

      let dbId: string = crypto.randomUUID();
      const existing = await c.env.DB.prepare(
        `SELECT id FROM saved_chains WHERE user_id = ? AND content_md5 = ?`,
      )
        .bind(userId, contentMd5)
        .first();

      if (existing) {
        dbId = existing.id as string;
        await c.env.DB.prepare(`UPDATE saved_chains SET name = ?, created_at = ? WHERE id = ?`)
          .bind(name, Date.now(), dbId)
          .run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO saved_chains (id, user_id, name, content_md5, is_favorite, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
        )
          .bind(dbId, userId, name, contentMd5, Date.now())
          .run();
      }

      return c.json({ success: true, id: dbId });
    } catch (error: any) {
      console.error("Save chain err:", error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.delete("/api/chains/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      await c.env.DB.prepare(`DELETE FROM saved_chains WHERE id = ? AND user_id = ?`)
        .bind(c.req.param("id"), userId)
        .run();
      return c.json({ success: true });
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });

  app.put("/api/chains/:id/favorite", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    try {
      const { isFavorite } = await c.req.json();
      await c.env.DB.prepare(`UPDATE saved_chains SET is_favorite = ? WHERE id = ? AND user_id = ?`)
        .bind(isFavorite ? 1 : 0, c.req.param("id"), userId)
        .run();
      return c.json({ success: true });
    } catch {
      return c.json({ success: false, error: "Database error" }, 500);
    }
  });
};
