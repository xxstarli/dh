import { db } from "./db";
import { AppError } from "./errors";
import { categorySchema, siteSchema, idsSchema } from "./validation";
import { assertIconExists } from "./storage";
import type { Prisma } from "@prisma/client";
type Tx = Prisma.TransactionClient;
async function category(tx: Tx, id: string) {
  if (!(await tx.category.findUnique({ where: { id } })))
    throw new AppError("CATEGORY_NOT_FOUND", "分类不存在，请刷新后重试", 404);
}
async function site(tx: Tx, id: string) {
  const value = await tx.site.findUnique({ where: { id } });
  if (!value)
    throw new AppError("SITE_NOT_FOUND", "网站不存在，请刷新后重试", 404);
  return value;
}
function exactIds(sent: string[], current: { id: string }[]) {
  if (
    sent.length !== current.length ||
    current.some((v) => !sent.includes(v.id))
  )
    throw new AppError(
      "INVALID_SORT_DATA",
      "排序数据已变化，请刷新后重试",
      409,
    );
}
export async function createCategory(input: unknown) {
  const value = categorySchema.parse(input);
  return db.$transaction(async (tx) => {
    const max = await tx.category.aggregate({ _max: { sort_order: true } });
    return tx.category.create({
      data: { ...value, sort_order: (max._max.sort_order || 0) + 1 },
    });
  });
}
export async function editCategory(id: string, input: unknown) {
  const value = categorySchema.parse(input);
  return db.$transaction(async (tx) => {
    await category(tx, id);
    return tx.category.update({ where: { id }, data: value });
  });
}
export async function deleteCategory(id: string) {
  return db.$transaction(async (tx) => {
    await category(tx, id);
    const count = await tx.site.count({ where: { category_id: id } });
    if (count)
      throw new AppError(
        "CATEGORY_NOT_EMPTY",
        `当前分类下还有 ${count} 个网站，请先移动或删除这些网站。`,
      );
    return tx.category.delete({ where: { id } });
  });
}
export async function reorderCategories(input: unknown) {
  const ids = idsSchema.parse(input);
  return db.$transaction(async (tx) => {
    exactIds(ids, await tx.category.findMany({ select: { id: true } }));
    for (const [i, id] of ids.entries())
      await tx.category.update({ where: { id }, data: { sort_order: i + 1 } });
  });
}
export async function saveSite(id: string | null, input: unknown) {
  const value = siteSchema.parse(input);
  if (value.icon_url) await assertIconExists(value.icon_url);
  return db.$transaction(async (tx) => {
    await category(tx, value.category_id);
    const old = id ? await site(tx, id) : null;
    const same = old?.category_id === value.category_id;
    const max = same
      ? null
      : await tx.site.aggregate({
          where: { category_id: value.category_id },
          _max: { sort_order: true },
        });
    const sort_order = same ? old!.sort_order : (max?._max.sort_order || 0) + 1;
    return id
      ? tx.site.update({ where: { id }, data: { ...value, sort_order } })
      : tx.site.create({ data: { ...value, sort_order } });
  });
}
export async function deleteSite(id: string) {
  return db.$transaction(async (tx) => {
    await site(tx, id);
    return tx.site.delete({ where: { id } });
  });
}
export async function reorderSites(categoryId: string, input: unknown) {
  const ids = idsSchema.parse(input);
  return db.$transaction(async (tx) => {
    await category(tx, categoryId);
    exactIds(
      ids,
      await tx.site.findMany({
        where: { category_id: categoryId },
        select: { id: true },
      }),
    );
    for (const [i, id] of ids.entries())
      await tx.site.update({ where: { id }, data: { sort_order: i + 1 } });
  });
}
