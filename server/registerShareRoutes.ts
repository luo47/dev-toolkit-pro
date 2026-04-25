import { zipSync } from "fflate";
import type { Hono } from "hono";
import type { AppContext, Bindings, FileItem } from "./serverTypes";
import { generateShareId, getUserFromSession } from "./serverUtils";

type ShareRow = {
  id: string;
  user_id: string;
  type: "text" | "file";
  content: string | null;
  files: string | null;
  total_size: number | null;
  name: string | null;
  source_type: string | null;
  source_id: string | null;
  edit_token: string | null;
  created_at: string;
  updated_at: string;
};
type ShareFile = FileItem;
type TextShareBody = { content: string; name?: string; sourceId?: string };
type ShareUpdateBody = { content?: string; name?: string };
type ShareLookupRow = { id: string };

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const parseShareFiles = (files: string | null): ShareFile[] | undefined => {
  if (!files) return undefined;
  try {
    return JSON.parse(files) as ShareFile[];
  } catch (e) {
    console.error("Failed to parse share files:", e);
    return [];
  }
};

const parseShareItem = (row: ShareRow) => ({
  id: row.id,
  type: row.type,
  content: row.content,
  files: parseShareFiles(row.files),
  totalSize: row.total_size,
  name: row.name,
  sourceType: row.source_type === "snippet" ? "snippet" : null,
  sourceId: row.source_id,
  editToken: row.edit_token,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const findExistingSharedSnippet = async (c: AppContext, userId: string, sourceId?: string) => {
  if (!sourceId) return null;
  const kvKey = `snippet_share:${userId}:${sourceId}`;
  const existingId = await c.env.SHARE_KV.get(kvKey);
  if (!existingId) return null;
  const exists = await c.env.DB.prepare("SELECT id FROM shares WHERE id = ? AND user_id = ?")
    .bind(existingId, userId)
    .first<ShareLookupRow>();
  if (exists) {
    await c.env.DB.prepare(
      "UPDATE shares SET source_type = COALESCE(source_type, ?), source_id = COALESCE(source_id, ?) WHERE id = ? AND user_id = ?",
    )
      .bind("snippet", sourceId, existingId, userId)
      .run();
  }
  return exists ? existingId : null;
};

const createTextShareRecord = async (c: AppContext, userId: string, body: TextShareBody) => {
  const id = await generateShareId(c.env.DB);
  const now = new Date().toISOString();
  const editToken = null;
  await c.env.DB.prepare(
    "INSERT INTO shares (id, user_id, type, content, name, source_type, source_id, edit_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      userId,
      "text",
      body.content,
      body.name || "未命名文本分享",
      body.sourceId ? "snippet" : null,
      body.sourceId || null,
      editToken,
      now,
      now,
    )
    .run();
  if (body.sourceId) {
    await c.env.SHARE_KV.put(`snippet_share:${userId}:${body.sourceId}`, id);
  }
  return {
    id,
    type: "text",
    content: body.content,
    name: body.name || "未命名文本分享",
    sourceType: body.sourceId ? "snippet" : null,
    sourceId: body.sourceId || null,
    editToken,
    createdAt: now,
    updatedAt: now,
  };
};
const canDownloadShare = (existing: ShareRow | null) => {
  if (!existing) return { error: "分享不存在", status: 404 };
  if (existing.type !== "file" || !existing.files) return { error: "没有可下载的文件", status: 404 };
  const files = parseShareFiles(existing.files) || [];
  if (files.length === 0) return { error: "没有可下载的文件", status: 404 };
  if ((existing.total_size || 0) > 50 * 1024 * 1024) {
    return { error: "打包文件总大小超过 50MB 限制，请使用其他工具或单独下载", status: 400 };
  }
  return { files, status: 200 };
};
const sanitizePath = (path: string) => {
  return path
    .replace(/[\\/]\.\.[\\/]/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\.[\\/]/g, "");
};
const buildZipResponse = async (bucket: R2Bucket, files: ShareFile[], zipName: string) => {
  const zipData: Record<string, Uint8Array> = {};
  for (const file of files) {
    const object = await bucket.get(file.key);
    if (object) {
      const safePath = sanitizePath(file.path);
      zipData[safePath || file.name] = new Uint8Array(await object.arrayBuffer());
    }
  }
  const zipped = zipSync(zipData, { level: 6 });
  const zipBuffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
  return new Response(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Content-Length": zipped.length.toString(),
    },
  });
};
interface ShareStrategy {
  getNewContent(existing: ShareRow, body: ShareUpdateBody): string | null;
  onDelete?(c: AppContext, existing: ShareRow): void;
  onPreview(c: AppContext, existing: ShareRow): Response | Promise<Response>;
}
const shareStrategies: Record<string, ShareStrategy> = {
  text: {
    getNewContent: (existing, body) => (body.content !== undefined ? body.content : existing.content),
    onPreview: (c, existing) => {
      c.header("Content-Type", "text/plain; charset=utf-8");
      return c.text((existing.content as string) || "");
    },
  },
  file: {
    getNewContent: (existing) => existing.content,
    onDelete: (c, existing) => {
      if (existing.files) {
        const files = parseShareFiles(existing.files) || [];
        c.executionCtx.waitUntil(Promise.all(files.map((file) => c.env.SHARE_R2.delete(file.key))));
      }
    },
    onPreview: (c, existing) => {
      return c.redirect(`${c.env.FRONTEND_URL || "https://www.928496.xyz"}/share-preview/${existing.id}`, 302);
    },
  },
};
const registerShareCrudRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/shares", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);
    try {
      const results = await c.env.DB.prepare("SELECT * FROM shares WHERE user_id = ? ORDER BY created_at DESC")
        .bind(userId)
        .all<ShareRow>();
      return c.json({ success: true, data: results.results.map(parseShareItem) });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Failed to list shares") }, 500);
    }
  });
  app.post("/api/shares", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const body = (await c.req.json()) as TextShareBody;
      if (!body.content) return c.json({ success: false, error: "内容不能为空" }, 400);
      const existingId = await findExistingSharedSnippet(c, userId, body.sourceId);
      if (existingId) return c.json({ success: true, alreadyExists: true, shareId: existingId });
      return c.json({ success: true, data: await createTextShareRecord(c, userId, body) });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Failed to create share") }, 500);
    }
  });

  app.put("/api/shares/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(c.req.param("id"), userId)
        .first<ShareRow>();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      const body = (await c.req.json()) as ShareUpdateBody;
      const now = new Date().toISOString();
      const strategy = shareStrategies[existing.type] || shareStrategies.text;
      const newContent = strategy.getNewContent(existing, body);
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
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "更新分享失败") }, 500);
    }
  });

  app.delete("/api/shares/:id", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(c.req.param("id"), userId)
        .first<ShareRow>();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      const strategy = shareStrategies[existing.type];
      strategy?.onDelete?.(c, existing);

      await c.env.DB.prepare("DELETE FROM shares WHERE id = ?").bind(c.req.param("id")).run();
      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "删除分享失败") }, 500);
    }
  });

  app.post("/api/shares/:id/token/regenerate", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const id = c.req.param("id");
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(id, userId)
        .first<ShareRow>();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      const newToken = crypto.randomUUID();
      await c.env.DB.prepare("UPDATE shares SET edit_token = ? WHERE id = ?").bind(newToken, id).run();

      return c.json({ success: true, editToken: newToken });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "重新生成密钥失败") }, 500);
    }
  });

  app.delete("/api/shares/:id/token", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const id = c.req.param("id");
      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ? AND user_id = ?")
        .bind(id, userId)
        .first<ShareRow>();
      if (!existing) return c.json({ success: false, error: "分享不存在或无权操作" }, 404);

      await c.env.DB.prepare("UPDATE shares SET edit_token = NULL WHERE id = ?").bind(id).run();

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "注销密钥失败") }, 500);
    }
  });
};

const processUploadedFiles = async (c: AppContext, id: string, files: File[]) => {
  const fileItems: FileItem[] = [];
  let totalSize = 0;

  for (const file of files) {
    const relativePath = sanitizePath(file.name);
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
  return { fileItems, totalSize };
};

const registerFileUploadRoute = (app: Hono<{ Bindings: Bindings }>) => {
  app.post("/api/files", async (c) => {
    const userId = await getUserFromSession(c);
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    try {
      const formData = await c.req.formData();
      const files = formData.getAll("files") as File[];
      const shareName = (formData.get("name") as string) || "";
      if (files.length === 0) return c.json({ success: false, error: "没有提供文件" }, 400);

      const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
      const totalUploadSize = files.reduce((acc, f) => acc + f.size, 0);
      if (totalUploadSize > MAX_TOTAL_SIZE) {
        return c.json({ success: false, error: "总文件大小不能超过 100MB" }, 400);
      }

      const id = await generateShareId(c.env.DB);
      const { fileItems, totalSize } = await processUploadedFiles(c, id, files);
      const now = new Date().toISOString();

      // 不再自动生成密钥，设为 null
      const editToken = null;
      await c.env.DB.prepare(
        "INSERT INTO shares (id, user_id, type, files, total_size, name, edit_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(
          id,
          userId,
          "file",
          JSON.stringify(fileItems),
          totalSize,
          shareName || fileItems[0].name,
          editToken,
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
          sourceType: null,
          sourceId: null,
          editToken,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "Upload failed") }, 500);
    }
  });
};

const registerPublicShareRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  app.get("/api/public/share/:id", async (c) => {
    const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?")
      .bind(c.req.param("id"))
      .first<ShareRow>();
    if (!existing) return c.json({ success: false, error: "分享不存在" }, 404);
    return c.json({
      success: true,
      data: {
        id: existing.id,
        type: existing.type,
        name: existing.name,
        files: parseShareFiles(existing.files),
        totalSize: existing.total_size,
        sourceType: existing.source_type === "snippet" ? "snippet" : null,
        sourceId: existing.source_id,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      },
    });
  });

  app.post("/api/public/share/:id/update", async (c) => {
    try {
      const id = c.req.param("id");
      const body = (await c.req.json()) as ShareUpdateBody & { editToken: string };

      if (!body.editToken) {
        return c.json({ success: false, error: "缺少修改密钥 (editToken)" }, 400);
      }

      const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?").bind(id).first<ShareRow>();

      if (!existing) {
        return c.json({ success: false, error: "分享不存在" }, 404);
      }

      if (!existing.edit_token || existing.edit_token !== body.editToken) {
        return c.json({ success: false, error: "修改密钥无效或无权操作" }, 403);
      }

      const now = new Date().toISOString();
      const strategy = shareStrategies[existing.type] || shareStrategies.text;
      const newContent = strategy.getNewContent(existing, body);
      const newName = body.name !== undefined ? body.name : existing.name;

      const result = await c.env.DB.prepare(
        "UPDATE shares SET content = ?, name = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
      )
        .bind(newContent, newName, now, id, existing.updated_at)
        .run();

      if (result.meta.changes === 0) {
        return c.json({ success: false, error: "更新失败：数据已被他人修改，请刷新后重试" }, 409);
      }

      return c.json({
        success: true,
        data: {
          ...parseShareItem(existing),
          content: newContent,
          name: newName,
          updatedAt: now,
        },
      });
    } catch (error) {
      return c.json({ success: false, error: getErrorMessage(error, "更新分享失败") }, 500);
    }
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
      .first<ShareRow>();
    const downloadable = canDownloadShare(existing);
    if ("error" in downloadable) {
      return c.json({ success: false, error: downloadable.error }, downloadable.status as 400 | 404);
    }

    if (!existing) return c.json({ success: false, error: "分享不存在" }, 404);

    try {
      return buildZipResponse(c.env.SHARE_R2, downloadable.files, `${existing.name || c.req.param("id")}.zip`);
    } catch (error) {
      return c.json({ success: false, error: `打包失败: ${getErrorMessage(error, "未知错误")}` }, 500);
    }
  });

  app.get("/s/:id", async (c) => {
    const existing = await c.env.DB.prepare("SELECT * FROM shares WHERE id = ?")
      .bind(c.req.param("id"))
      .first<ShareRow>();
    if (!existing) return c.text("分享不存在或已过期", 404);
    const strategy = shareStrategies[existing.type];
    if (!strategy) return c.text("不支持的分享类型", 400);
    return strategy.onPreview(c, existing);
  });
};

export const registerShareRoutes = (app: Hono<{ Bindings: Bindings }>) => {
  registerShareCrudRoutes(app);
  registerFileUploadRoute(app);
  registerPublicShareRoutes(app);
};
