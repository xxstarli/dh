import { z } from "zod";
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  if (!raw || /[\s\\\u0000-\u001f]/.test(raw))
    throw new Error("请输入正确的网站地址");
  const hasScheme =
    /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/:]+\.\w+:\d+(\/|$)/.test(raw);
  const url = new URL(hasScheme ? raw : "https://" + raw);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname ||
    (!url.hostname.includes(".") &&
      url.hostname !== "localhost" &&
      !url.hostname.includes(":"))
  )
    throw new Error("请输入正确的 HTTP / HTTPS 网站地址");
  return url.href;
}
const name = z
  .string()
  .trim()
  .min(1, "名称不能为空")
  .max(30, "名称最多 30 字符");
export const categorySchema = z.object({ name }).strict();
export const urlSchema = z
  .string()
  .max(2048, "网址过长")
  .transform((v, ctx) => {
    try {
      return normalizeUrl(v);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "请输入正确的 HTTP / HTTPS 网站地址",
      });
      return z.NEVER;
    }
  });
export const iconPath = z
  .string()
  .regex(/^\/api\/icons\/[a-f0-9]{64}\.webp$/, "图标地址无效")
  .nullable();
export const siteSchema = z
  .object({
    name,
    url: urlSchema,
    description: z
      .string()
      .trim()
      .max(50, "说明最多 50 字符")
      .nullable()
      .optional()
      .transform((v) => v || null),
    category_id: z.string().min(1, "请选择所属分类"),
    icon_type: z.enum(["auto", "custom", "default"]).default("default"),
    icon_url: iconPath.default(null),
  })
  .strict()
  .refine(
    (v) =>
      v.icon_type === "default" ? v.icon_url === null : v.icon_url !== null,
    { message: "图标状态无效", path: ["icon_url"] },
  );
export const idsSchema = z
  .array(z.string().min(1))
  .max(10000)
  .refine((v) => new Set(v).size === v.length, "排序不能包含重复 ID");
export function filterCategories(
  categories: import("./types").Category[],
  search: string,
  admin: boolean,
) {
  const q = search.trim().toLocaleLowerCase();
  return categories
    .map((c) => ({
      ...c,
      sites: c.sites.filter(
        (s) =>
          !q ||
          [s.name, s.description || "", new URL(s.url).hostname].some((v) =>
            v.toLocaleLowerCase().includes(q),
          ),
      ),
    }))
    .filter((c) => c.sites.length > 0 || (admin && !q));
}
