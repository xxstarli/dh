import { z } from "zod";
import {
  authenticated,
  requireAdmin,
  sameOrigin,
  login,
  logout,
} from "@/lib/auth";
import { ok, failure, jsonBody, limitedBody } from "@/lib/http";
import { AppError } from "@/lib/errors";
import * as service from "@/lib/service";
import { fetchFavicon } from "@/lib/favicon";
import { storeImage, MAX_ICON } from "@/lib/storage";
import { urlSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, context: Context) {
  try {
    const parts = (await context.params).path,
      path = parts.join("/"),
      method = request.method;
    if (path === "session" && method === "GET")
      return ok({ authenticated: await authenticated() });
    if (path === "login" && method === "POST") {
      sameOrigin(request);
      const data = z
        .object({
          password: z.string().min(1, "请输入管理密码").max(72, "密码过长"),
        })
        .strict()
        .parse(await jsonBody(request));
      await login(data.password);
      return ok();
    }
    await requireAdmin();
    if (method !== "GET") sameOrigin(request);
    if (path === "logout" && method === "POST") {
      await logout();
      return ok();
    }
    if (path === "categories" && method === "POST")
      return ok(await service.createCategory(await jsonBody(request)), 201);
    if (path === "categories/reorder" && method === "PUT") {
      const body = z
        .object({ category_ids: z.unknown() })
        .strict()
        .parse(await jsonBody(request));
      await service.reorderCategories(body.category_ids);
      return ok();
    }
    if (parts[0] === "categories" && parts.length === 2) {
      if (method === "PATCH")
        return ok(
          await service.editCategory(parts[1], await jsonBody(request)),
        );
      if (method === "DELETE")
        return ok(await service.deleteCategory(parts[1]));
    }
    if (path === "sites" && method === "POST")
      return ok(await service.saveSite(null, await jsonBody(request)), 201);
    if (path === "sites/reorder" && method === "PUT") {
      const body = z
        .object({ category_id: z.string(), site_ids: z.unknown() })
        .strict()
        .parse(await jsonBody(request));
      await service.reorderSites(body.category_id, body.site_ids);
      return ok();
    }
    if (parts[0] === "sites" && parts.length === 2) {
      if (method === "PATCH")
        return ok(await service.saveSite(parts[1], await jsonBody(request)));
      if (method === "DELETE") return ok(await service.deleteSite(parts[1]));
    }
    if (path === "favicon" && method === "POST") {
      const body = z
        .object({ url: urlSchema })
        .strict()
        .parse(await jsonBody(request));
      const icon_url = await fetchFavicon(body.url);
      return ok({ success: !!icon_url, icon_url });
    }
    if (path === "uploads/site-icon" && method === "POST") {
      const bytes = await limitedBody(request, MAX_ICON + 65536);
      const form = await new Response(new Uint8Array(bytes), {
        headers: { "Content-Type": request.headers.get("content-type") || "" },
      }).formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new AppError("INVALID_FILE_TYPE", "请选择图片");
      return ok({
        icon_url: await storeImage(
          Buffer.from(await file.arrayBuffer()),
          file.type,
        ),
      });
    }
    throw new AppError("NOT_FOUND", "接口不存在", 404);
  } catch (e) {
    return failure(e);
  }
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
