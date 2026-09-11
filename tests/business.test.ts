import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  normalizeUrl,
  siteSchema,
  categorySchema,
  filterCategories,
} from "../lib/validation";
import { isPublicAddress, safeDownload } from "../lib/favicon";
import { storeImage, readIcon } from "../lib/storage";
import { db } from "../lib/db";
import * as service from "../lib/service";
const folder = path.resolve("storage/unit-" + process.pid);
before(async () => {
  fs.mkdirSync(folder, { recursive: true });
  process.env.DATABASE_URL =
    "file:" + path.join(folder, "test.db").replaceAll("\\", "/");
  process.env.UPLOAD_DIR = path.join(folder, "icons");
  for (const sql of fs
    .readFileSync("prisma/migrations/202609110001_init/migration.sql", "utf8")
    .split(";")
    .filter((s) => s.trim()))
    await db.$executeRawUnsafe(sql);
});
after(async () => {
  await db.$disconnect();
});
test("URL normalization, unsafe protocols and malformed URLs", () => {
  for (const raw of ["example.com", " www.example.com "])
    assert.equal(new URL(normalizeUrl(raw)).protocol, "https:");
  assert.equal(normalizeUrl("http://example.com"), "http://example.com/");
  for (const raw of [
    "",
    "bad",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://exa mple.com",
    "https://example.com\\@localhost",
  ])
    assert.throws(() => normalizeUrl(raw), raw);
  assert.equal(
    normalizeUrl("example.com:8080/test"),
    "https://example.com:8080/test",
  );
});
test("shared schema trims and enforces required/length/category/icon fields", () => {
  assert.equal(categorySchema.parse({ name: " 常用 " }).name, "常用");
  for (const name of ["", " ", "a".repeat(31)])
    assert.equal(categorySchema.safeParse({ name }).success, false);
  const site = {
    name: " Example ",
    url: "example.com",
    category_id: "x",
    description: " note ",
  };
  assert.equal(siteSchema.parse(site).description, "note");
  for (const value of [
    { ...site, name: " " },
    { ...site, description: "a".repeat(51) },
    { ...site, category_id: "" },
    { ...site, icon_type: "custom", icon_url: "https://evil.com/icon.png" },
  ])
    assert.equal(siteSchema.safeParse(value).success, false);
});
test("SSRF public IP allowlist and blocked downloads", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.0.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "fc00::1",
    "224.0.0.1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
  for (const url of [
    "http://localhost",
    "http://127.0.0.1",
    "http://2130706433",
    "http://169.254.169.254",
    "http://[::ffff:127.0.0.1]",
    "http://example.com:8080",
  ])
    await assert.rejects(safeDownload(url));
});
test("image validation: decode PNG JPEG WebP, reject MIME spoofing/oversize/path traversal", async () => {
  for (const type of ["png", "jpeg", "webp"] as const) {
    const bytes = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#3285ff" },
    })
      .toFormat(type)
      .toBuffer();
    const url = await storeImage(bytes, "image/" + type);
    assert.match(url, /^\/api\/icons\/[a-f0-9]{64}\.webp$/);
    assert.ok((await readIcon(path.basename(url))).length > 0);
  }
  await assert.rejects(
    storeImage(Buffer.alloc(2 * 1024 * 1024 + 1), "image/png"),
  );
  await assert.rejects(
    storeImage(Buffer.from("<script>alert(1)</script>"), "image/png"),
  );
  const png = await sharp({
    create: { width: 2, height: 2, channels: 4, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(storeImage(png, "image/jpeg"));
  await assert.rejects(readIcon("../../.env"));
});
test("database CRUD, duplicate names/URLs, restriction, complete transactional sorting and move-to-end", async () => {
  const a = await service.createCategory({ name: "A" }),
    b = await service.createCategory({ name: "B" }),
    c = await service.createCategory({ name: "A" });
  assert.deepEqual(
    (await db.category.findMany({ orderBy: { sort_order: "asc" } })).map(
      (v) => v.id,
    ),
    [a.id, b.id, c.id],
  );
  await service.editCategory(a.id, { name: " A edited " });
  assert.equal(
    (await db.category.findUniqueOrThrow({ where: { id: a.id } })).name,
    "A edited",
  );
  const input = { name: "site", url: "example.com", category_id: a.id };
  const one = await service.saveSite(null, input),
    two = await service.saveSite(null, input),
    three = await service.saveSite(null, { ...input, category_id: b.id });
  assert.equal(two.sort_order, one.sort_order + 1);
  await assert.rejects(service.deleteCategory(a.id), /还有 2 个网站/);
  await assert.rejects(db.category.delete({ where: { id: a.id } }));
  await assert.rejects(
    service.saveSite(null, { ...input, category_id: "missing" }),
  );
  const edited = await service.saveSite(one.id, { ...input, name: "edited" });
  assert.equal(edited.sort_order, one.sort_order);
  await service.reorderSites(a.id, [two.id, one.id]);
  await assert.rejects(service.reorderSites(a.id, [two.id, two.id]));
  await assert.rejects(service.reorderSites(a.id, [two.id, three.id]));
  await assert.rejects(service.reorderSites(a.id, [one.id]));
  assert.deepEqual(
    (
      await db.site.findMany({
        where: { category_id: a.id },
        orderBy: { sort_order: "asc" },
      })
    ).map((v) => v.id),
    [two.id, one.id],
  );
  const moved = await service.saveSite(one.id, { ...input, category_id: b.id });
  assert.equal(moved.sort_order, three.sort_order + 1);
  await service.reorderCategories([c.id, b.id, a.id]);
  await assert.rejects(service.reorderCategories([a.id, a.id, c.id]));
  assert.deepEqual(
    (await db.category.findMany({ orderBy: { sort_order: "asc" } })).map(
      (v) => v.id,
    ),
    [c.id, b.id, a.id],
  );
  await service.deleteSite(two.id);
  await service.deleteCategory(a.id);
  assert.equal(await db.site.count({ where: { category_id: b.id } }), 2);
  await assert.rejects(service.deleteSite("missing"));
});
test("search filters name/description/domain case-insensitively, hides empties, keeps order", () => {
  const categories = [
    {
      id: "c",
      name: "category",
      sort_order: 1,
      sites: [
        {
          id: "s",
          category_id: "c",
          name: "GitHub",
          url: "https://github.com/path",
          icon_type: "default" as const,
          icon_url: null,
          description: "代码协作",
          sort_order: 2,
        },
      ],
    },
    { id: "empty", name: "empty", sort_order: 2, sites: [] },
  ];
  for (const q of [" GITHUB ", "代码", "github.com"])
    assert.equal(filterCategories(categories, q, false)[0].sites[0].id, "s");
  assert.equal(filterCategories(categories, "category", false).length, 0);
  assert.equal(filterCategories(categories, "", false).length, 1);
  assert.equal(filterCategories(categories, "", true).length, 2);
  assert.equal(categories[0].sites[0].sort_order, 2);
});
