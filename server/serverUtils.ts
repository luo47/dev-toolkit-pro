import { getCookie } from "hono/cookie";
import type { AppContext } from "./serverTypes";

type SessionUserRow = {
  id: string;
};

export const getUserFromSession = async (c: AppContext) => {
  const sessionId = getCookie(c, "auth_session");
  if (!sessionId) return null;
  const result = await c.env.DB.prepare(
    `SELECT users.id
     FROM users
     JOIN sessions ON users.id = sessions.user_id
     WHERE sessions.id = ? AND sessions.expires_at > ?`,
  )
    .bind(sessionId, Math.floor(Date.now() / 1000))
    .first<SessionUserRow>();
  return result?.id ?? null;
};

export const generateShareId = async (db: D1Database) => {
  for (let i = 0; i < 5; i++) {
    const id = crypto.randomUUID().split("-")[0];
    const existing = await db.prepare("SELECT id FROM shares WHERE id = ?").bind(id).first();
    if (!existing) return id;
  }
  return crypto.randomUUID().split("-")[0];
};
