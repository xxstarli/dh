import "dotenv/config";
import { db } from "../lib/db";
async function main() {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(hash))
    throw new Error(
      "请先运行 pnpm admin:password 并配置 ADMIN_PASSWORD_HASH（bcrypt cost 12）",
    );
  await db.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      site_name: process.env.SITE_NAME?.trim() || "我的导航",
      site_logo: process.env.SITE_LOGO?.trim() || null,
      admin_password_hash: hash,
    },
    update: {},
  });
  console.info("站点设置已初始化；未添加示例分类或网站。");
}
main()
  .catch(() => {
    console.error("初始化失败，请检查 .env 中的密码哈希和数据库路径。");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
