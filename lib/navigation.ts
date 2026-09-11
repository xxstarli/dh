import { db } from "./db";
import type { NavigationData } from "./types";
export async function getNavigation(): Promise<NavigationData> {
  const [settings, categories] = await db.$transaction([
    db.settings.findUnique({
      where: { id: "singleton" },
      select: { site_name: true, site_logo: true },
    }),
    db.category.findMany({
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        sort_order: true,
        sites: {
          orderBy: [{ sort_order: "asc" }, { id: "asc" }],
          select: {
            id: true,
            category_id: true,
            name: true,
            url: true,
            icon_type: true,
            icon_url: true,
            description: true,
            sort_order: true,
          },
        },
      },
    }),
  ]);
  if (!settings) throw new Error("站点尚未初始化");
  return { settings, categories } as NavigationData;
}
