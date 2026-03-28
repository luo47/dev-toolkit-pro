import { zipSync } from "fflate";
import type { Hono } from "hono";
import type { Bindings, FileItem } from "./serverTypes";
import { generateShareId, getUserFromSession } from "./serverUtils";

const parseShareItem = (row: any) => ({
  id: row.id,
  type: row.type,
  content: row.content,
  files: row.files ? JSON.parse(row.files) : undefined,
  totalSize: row.total_size,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const findExistingSharedSnippet = async (c: any, userId: string, sourceId?: string) => {
  if (!sourceId) return null;
  const kvKey = `snippet_share:${userId}:${sourceId}`;
  const existingId = await c.env.SHARE_KV.get(kvKey);
  if (!existingId) return null;
  const exists = await c.env.DB.prepare("SELECT id FROM shares WHERE id = ? AND user_id = ?")
    .bind(existingId, userId)
    .first();
  return exists ? existingId : null;
};

const createTextShareRecord = async (
  c: any,
  userId: string,
  body: { content: string; name?: string; sourceId?: string },
) => {
  const id = await generateShareId(c.env.DB);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO shares (id, user_id, type, content, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, "text", body.content, body.name || "未命名文本分享", now, now)
    .run();
  if (body.sourceId) {
    await c.env.SHARE_KV.put(`snippet_share:${userId}:${body.sourceId}`, id);
  }
  return {
    id,
    type: "text",
    content: body.content,
    name: body.name || "未命名文本分享",
    createdAt: now,
    updatedAt: now,
  };
};

const canDownloadShare = (existing: any) => {
  if (!existing) return { error: "分享不存在", status: 404 };
  if (existing.type !== "file" || !existing.files)
    return { error: "没有可下载的文件", status: 404 };
  const files = JSON.parse(existing.files as string);
  if (files.length === 0) return { error: "没有可下载的文件", status: 404 };
  if ((existing.total_size as number) > 50 * 1024 * 1024) {
    return { error: "打包文件总大小超过 50MB 限制，请使用其他工具或单独下载", status: 400 };
  }
  return { files, status: 200 };
};

const buildZipResponse = async (bucket: R2Bucket, files: any[], zipName: string) => {
  const zipData: Record<string, Uint8Array> = {};
  for (const file of files) {
    const object = await bucket.get(file.key);
    if (object) zipData[file.path] = new Uint8Array(await object.arrayBuffer());
  }
  const zipped = zipSync(zipData, { level: 6 });
  return new Response(zipped as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Content-Length": zipped.length.toString(),
    },
  });
};

export const registerShareRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/shares", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);
    try {
      const results = await c.env.DB.prepare(
        "SELECT * FROM shares WHERE user_id = ? ORDER BY created_at DESC",
      )
        .bind(userId)
        .all();
      return c.json({ success: true, data: results.results.map(parseShareItem) });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to list shares" }, 500);
    }
  });

  app.post("/api/shares", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const body = (await c.req.json()) as { content: string; name?: string; sourceId?: string };
      if (!body.content) return c.json({ success: false, error: "内容不能为空" }, 400);
      const existingId = await findExistingSharedSnippet(c, userId, body.sourceId);
      if (existingId) return c.json({ success: true, alreadyExists: true, shareId: existingId });
      return c.json({ success: true, data: await createTextShareRecord(c, userId, body) });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Failed to create share" }, 500);
    }
  });

  app.put("/api/shares/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(c.req.param("id"), userId)
        .first();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      const body = (await c.req.json()) as { content?: string; name?: string };
      const now = new Date().toISOString();
      const newContent =
        existing.type === "text" && body.content !== undefined ? body.content : existing.content;
      const newName = body.name !== undefined ? body.name : existing.name;

      await c.env.DB.prepare("UPDATE shares SET content = ?, name = ?, updated_at = ? WHERE id = ?")
        .bind(newContent, newName, now, c.req.param("id"))
        .run();

      return c.json({
        success: true,
        data: {
          ...parseShareItem(existing),
          content: newContent,
          name: newName,
          updatedAt: now,
        },
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.delete("/api/shares/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(c.req.param("id"), userId)
        .first();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      if (existing.type === "file" && existing.files) {
        const files = JSON.parse(existing.files as string);
        c.executionCtx.waitUntil(
          Promise.all(files.map((file: any) => c.env.SHARE_R2.delete(file.key))),
        );
      }

      await c.env.DB.prepare("DELETE FROM shares WHERE id = ?").bind(c.req.param("id")).run();
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  app.post("/api/files", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const formData = await c.req.formData();
      const files = formData.getAll("files") as File[];
      const shareName = (formData.get("name") as string) || "";
      if (files.length === 0) return c.json({ success: false, error: "没有提供文件" }, 400);

      const id = await generateShareId(c.env.DB);
      const now = new Date().toISOString();
      const fileItems: FileItem[] = [];
      let totalSize = 0;

      for (const file of files) {
        const relativePath = file.name;
        const key = `${id}/${relativePath}`;
        await c.env.SHARE_R2.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
          customMetadata: {
            fileName: file.name,
            filePath: relativePath,
            shareId: id,
          },
        });
        fileItems.push({
          key,
          name: file.name.split("/").pop() || file.name,
          path: relativePath,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        });
        totalSize += file.size;
      }

      await c.env.DB.prepare(
        "INSERT INTO shares (id, user_id, type, files, total_size, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          userId,
          "file",
          JSON.stringify(fileItems),
          totalSize,
          shareName || fileItems[0].name,
          now,
          now,
        )
        .run();

      return c.json({
        success: true,
        data: {
          id,
          type: "file",
          files: fileItems,
          totalSize,
          name: shareName || fileItems[0].name,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error: any) {
      return c.json({ success: false, error: error.message || "Upload failed" }, 500);
    }
  });

  app.get("/api/public/share/:id", async (c) => {
    const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?")
      .bind(c.req.param("id"))
      .first();
    if (!existing) return c.json({ success: false, error: "分享不存在" }, 404);
    return c.json({
      success: true,
      data: {
        id: existing.id,
        type: existing.type,
        name: existing.name,
        files: existing.files ? JSON.parse(existing.files as string) : undefined,
        totalSize: existing.total_size,
        createdAt: existing.created_at,
      },
    });
  });

  app.get("/api/public/download/:id/:path{.+}", async (c) => {
    const filePath = c.req.param("path");
    const object = await c.env.SHARE_R2.get(`${c.req.param("id")}/${filePath}`);
    if (!object) return c.json({ success: false, error: "文件不存在" }, 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filePath.split("/").pop() || "file")}`,
    );
    return new Response(object.body, { headers });
  });

  app.get("/api/public/download/:id", async (c) => {
    const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?")
      .bind(c.req.param("id"))
      .first();
    const downloadable = canDownloadShare(existing);
    if ("error" in downloadable) {
      return c.json(
        { success: false, error: downloadable.error },
        downloadable.status as 400 | 404,
      );
    }

    try {
      return buildZipResponse(
        c.env.SHARE_R2,
        downloadable.files,
        `${existing.name || c.req.param("id")}.zip`,
      );
    } catch (error: any) {
      return c.json({ success: false, error: `打包失败: ${error.message}` }, 500);
    }
  });

  app.get("/s/:id", async (c) => {
    const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?")
      .bind(c.req.param("id"))
      .first();
    if (!existing) return c.text("分享不存在或已过期", 404);
    if (existing.type === "text") {
      c.header("Content-Type", "text/plain; charset=utf-8");
      return c.text((existing.content as string) || "");
    }
    return c.redirect(
      `${c.env.FRONTEND_URL || "https://www.928496.xyz"}/share-preview/${c.req.param("id")}`,
      302,
    );
  });
};
