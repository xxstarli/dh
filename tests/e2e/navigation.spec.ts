import { test, expect, type Page, type Locator } from "@playwright/test";
import { database } from "../db";
import path from "node:path";
import fs from "node:fs";
import images from "../images.json";
const password = "Navigation-test-only-2026";
const origin = "http://localhost:3100";
async function adminHeaders(page: Page) {
 const data = await (await page.request.get('/api/admin/session')).json();
 return {origin, 'X-CSRF-Token': data.csrf_token || ''};
}
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource"))
      errors.push(m.text());
  });
  fs.rmSync(path.resolve('storage/e2e/state/login-rate.json'),{force:true});
  await database.site.deleteMany();
  await database.category.deleteMany();
  await database.adminSession.deleteMany();
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
test.afterAll(async () => database.$disconnect());
async function login(page: Page) {
  await page.getByRole("button", { name: "管理", exact: true }).click();
  await page.getByLabel("管理密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "进入管理", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "完成管理", exact: true }),
  ).toBeVisible();
}
async function addCategory(page: Page, name: string) {
  const first = page.getByRole("button", {
    name: "添加第一个分类",
    exact: true,
  });
  if (await first.isVisible()) await first.click();
  else
    await page.getByRole("button", { name: "添加分类", exact: true }).click();
  await page.getByLabel("分类名称").fill(name);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function addSite(
  page: Page,
  category: string,
  name: string,
  url = "http://127.0.0.1",
  description = "",
) {
  await page
    .getByRole("region", { name: category, exact: true })
    .getByRole("button", { name: "添加网站", exact: true })
    .click();
  await page.getByLabel("网站名称").fill(name);
  await page.getByLabel("网站地址").fill(url);
  await page.getByLabel("网站说明").fill(description);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function edit(page: Page, name: string) {
  await page
    .getByRole("button", { name: name + "更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
}
async function drag(page: Page, source: Locator, target: Locator) {
  await expect(source).toBeEnabled();
  await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(),
    b = await target.boundingBox();
  if (!a || !b) throw new Error("Missing drag box");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, {
    steps: 4,
  });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.mouse.up();
}
async function demo(count = 5) {
  const names = [
    "常用",
    "AI 工具",
    "开发工具",
    "办公工具",
    "设计素材",
    "卡牌业务",
  ];
  const labels = ["ChatGPT", "GitHub", "飞书", "Notion", "Gmail"];
  for (const [i, name] of names.entries()) {
    const c = await database.category.create({
      data: { name, sort_order: i + 1 },
    });
    for (let j = 0; j < (i === 0 ? count : 5); j++)
      await database.site.create({
        data: {
          category_id: c.id,
          name:
            i === 0
              ? labels[j] || "示例网站 " + j
              : ["Claude", "Vercel", "Supabase", "Docker", "Cloudflare"][j],
          url: "https://example.com/" + i + "/" + j,
          description:
            i === 0
              ? [
                  "AI 对话助手",
                  "代码托管与协作",
                  "高效协同办公",
                  "知识管理工具",
                  "谷歌邮箱",
                ][j % 5]
              : "常用网站入口",
          sort_order: j + 1,
        },
      });
  }
}
test("12 complete user journeys: login, CRUD, reorder, refresh, move, delete, search and exit", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("还没有添加分类", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "管理", exact: true }).click();
  await page.getByLabel("管理密码").fill("wrong-password");
  await page.getByRole("button", { name: "进入管理" }).click();
  await expect(page.getByText("管理密码错误，请重新输入")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.getByLabel("管理密码").fill(password);
  await page.getByRole("button", { name: "进入管理" }).click();
  await expect(page.getByRole("button", { name: "完成管理" })).toBeVisible();
  const cookie = (await context.cookies()).find(
    (c) => c.name === "navigation_admin",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Strict");
  await addCategory(page, "分类 A");
  await page.reload();
  await expect(page.getByRole("region", { name: "分类 A" })).toBeVisible();
  await addCategory(page, "分类 B");
  await addSite(page, "分类 A", "Alpha", "example.com", "独特描述");
  await page.reload();
  await expect(page.getByText("Alpha", { exact: true })).toBeVisible();
  await addSite(page, "分类 A", "Beta");
  await addSite(page, "分类 B", "Existing");
  await edit(page, "Alpha");
  await expect(page.getByLabel("网站地址")).toHaveValue("https://example.com/");
  await page.getByLabel("网站名称").fill("Alpha Edited");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Alpha Edited", { exact: true })).toBeVisible();
  await edit(page, "Alpha Edited");
  const categoryB = await database.category.findFirstOrThrow({
    where: { name: "分类 B" },
  });
  await page.getByLabel("所属分类").selectOption(categoryB.id);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "分类 B" }).locator(".site-text strong"),
  ).toHaveText(["Existing", "Alpha Edited"]);
  const orderResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/categories/reorder") && r.request().method() === "PUT",
  );
  await drag(
    page,
    page.getByRole("button", { name: "拖动分类 分类 B", exact: true }),
    page.getByRole("button", { name: "拖动分类 分类 A", exact: true }),
  );
  expect((await orderResponse).ok()).toBe(true);
  await page.reload();
  await expect(page.locator(".category h2")).toHaveText(["分类 B", "分类 A"]);
  const siteResponse = page.waitForResponse(
    (r) => r.url().endsWith("/sites/reorder") && r.request().method() === "PUT",
  );
  await drag(
    page,
    page.getByRole("button", { name: "拖动网站 Alpha Edited", exact: true }),
    page.getByRole("button", { name: "拖动网站 Existing", exact: true }),
  );
  expect((await siteResponse).ok()).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "分类 B" }).locator(".site-text strong"),
  ).toHaveText(["Alpha Edited", "Existing"]);
  await page
    .getByRole("button", { name: "分类 B更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除分类", exact: true }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "还有 2 个网站",
  );
  await page.getByRole("button", { name: "Beta更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("Beta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Beta更多操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "分类 A更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除分类", exact: true }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "分类 A", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "完成管理" }).click();
  await expect(
    page.getByRole("button", { name: "管理", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".drag-handle")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "添加网站", exact: true }),
  ).toHaveCount(0);
  for (const query of [" ALPHA ", "独特描述", "example.com"]) {
    await page.getByLabel("搜索网站").fill(query);
    await expect(page.locator("a.site-card")).toHaveCount(1);
  }
  const popup = page.waitForEvent("popup");
  await page.locator("a.site-card").click();
  const newPage = await popup;
  await expect(newPage).toHaveURL("https://example.com/");
  await newPage.close();
  expect(page.url()).toBe(origin + "/");
  await page.getByLabel("搜索网站").fill("无结果测试");
  await expect(page.getByText("没有找到相关网站")).toBeVisible();
  await page
    .getByRole("button", { name: "清除搜索", exact: true })
    .last()
    .click();
  await expect(page.locator("a.site-card")).toHaveCount(2);
  expect(
    (
      await page.request.post("/api/admin/categories", {
        data: { name: "unauthorized" },
        headers: await adminHeaders(page),
      })
    ).status(),
  ).toBe(401);
  expect(errors).toEqual([]);
});
test("all write endpoints enforce authentication, origin and server validation", async ({
  page,
  request,
}) => {
  for (const [method, url] of [
    ["POST", "categories"],
    ["PATCH", "categories/missing"],
    ["DELETE", "categories/missing"],
    ["PUT", "categories/reorder"],
    ["POST", "sites"],
    ["PATCH", "sites/missing"],
    ["DELETE", "sites/missing"],
    ["PUT", "sites/reorder"],
    ["POST", "uploads/site-icon"],
    ["POST", "favicon"],
  ]) {
    const result = await request.fetch("/api/admin/" + url, {
      method,
      data: {},
      headers: await adminHeaders(page),
    });
    expect(result.status(), url).toBe(401);
  }
  const publicData = await (await request.get("/api/navigation")).text();
  expect(publicData).not.toContain("password");
  expect(publicData).not.toContain("admin_sessions");
  await page.goto("/");
  await login(page);
  expect(
    (
      await page.request.post("/api/admin/categories", {
        data: { name: "evil" },
        headers: { origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  for (const name of ["", " ", "x".repeat(31)])
    expect(
      (
        await page.request.post("/api/admin/categories", {
          data: { name },
          headers: await adminHeaders(page),
        })
      ).status(),
    ).toBe(400);
  const c = await (
    await page.request.post("/api/admin/categories", {
      data: { name: "valid" },
      headers: await adminHeaders(page),
    })
  ).json();
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///etc/passwd",
    "broken",
  ]) {
    expect(
      (
        await page.request.post("/api/admin/sites", {
          data: { name: "test", url, category_id: c.id },
          headers: await adminHeaders(page),
        })
      ).status(),
    ).toBe(400);
  }
  expect(
    (
      await page.request.put("/api/admin/categories/reorder", {
        data: { category_ids: [c.id, c.id] },
        headers: await adminHeaders(page),
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.delete("/api/admin/sites/missing", {
        headers: await adminHeaders(page),
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/admin/sites", {
        data: {
          name: "test",
          url: "https://example.com",
          category_id: "missing",
        },
        headers: await adminHeaders(page),
      })
    ).status(),
  ).toBe(404);
  const icon = await page.request.post("/api/admin/favicon", {
    data: { url: "http://169.254.169.254" },
    headers: await adminHeaders(page),
  });
  expect(await icon.json()).toMatchObject({ success: false, icon_url: null });
});
test("form errors, save failure retention, focus, upload validation and automatic fallback", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  await addCategory(page, "测试分类");
  await page.getByRole("button", { name: "添加网站", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("名称不能为空")).toBeVisible();
  await page.getByLabel("网站名称").fill("Persisted Form");
  await page.getByLabel("网站地址").fill("http://127.0.0.1");
  await page.getByLabel("网站说明").fill("表单保留");
  await expect(
    page.getByText("未获取到网站图标，将使用默认图标"),
  ).toBeVisible();
  await page.route("**/api/admin/sites", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "模拟保存失败" }),
    }),
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("模拟保存失败")).toBeVisible();
  await expect(page.getByLabel("网站名称")).toHaveValue("Persisted Form");
  await page.unroute("**/api/admin/sites");
  const png = Buffer.from(images.png, "base64");
  await page
    .getByLabel("上传网站图标")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("已使用自定义图标")).toBeVisible();
  await page.getByLabel("网站地址").fill("https://example.com");
  await page.getByLabel("网站说明").click();
  await expect(page.getByText("已使用自定义图标")).toBeVisible();
  await page.getByLabel("上传网站图标").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png"),
  });
  await expect(page.getByText("图片无法识别", { exact: false })).toBeVisible();
  await expect(page.getByLabel("网站说明")).toHaveValue("表单保留");
  await page.getByLabel("上传网站图标").setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.getByText("图片大小不能超过 2MB")).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const saved = await database.site.findFirstOrThrow({
    where: { name: "Persisted Form" },
  });
  expect(saved.icon_type).toBe("custom");
  expect((await page.request.get(saved.icon_url!)).status()).toBe(200);
  await edit(page, "Persisted Form");
  await page.getByLabel("网站地址").fill("http://127.0.0.1");
  await page.getByRole("button", { name: "恢复自动获取" }).click();
  await expect(
    page.getByText("未获取到网站图标，将使用默认图标"),
  ).toBeVisible();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(":focus")).not.toHaveJSProperty("tagName", "BODY");
});
test("sorting rollback, no cross-category drag, search guard and session expiry recovery", async ({
  page,
}) => {
  await demo(3);
  await page.goto("/");
  await login(page);
  const original = await page.locator(".category h2").allTextContents();
  await page.route("**/api/admin/categories/reorder", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "排序失败" }),
    }),
  );
  await drag(
    page,
    page.getByRole("button", { name: "拖动分类 AI 工具", exact: true }),
    page.getByRole("button", { name: "拖动分类 常用", exact: true }),
  );
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "已恢复原顺序",
  );
  await expect(page.locator(".category h2")).toHaveText(original);
  await page.unroute("**/api/admin/categories/reorder");
  const first = page.getByRole("region", { name: "常用", exact: true });
  const old = await first.locator(".site-text strong").allTextContents();
  await page.route("**/api/admin/sites/reorder", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "网站排序失败" }),
    }),
  );
  await drag(
    page,
    first.getByRole("button", { name: "拖动网站 GitHub", exact: true }),
    first.getByRole("button", { name: "拖动网站 ChatGPT", exact: true }),
  );
  await expect(page.locator(".notice[role=alert]")).toContainText(
    "网站排序失败",
  );
  await expect(first.locator(".site-text strong")).toHaveText(old);
  await page.unroute("**/api/admin/sites/reorder");
  const before = await database.site.findMany({
    select: { id: true, category_id: true },
    orderBy: { id: "asc" },
  });
  await drag(
    page,
    first.getByRole("button", { name: "拖动网站 ChatGPT", exact: true }),
    page
      .getByRole("region", { name: "AI 工具", exact: true })
      .locator(".site-card")
      .first(),
  );
  expect(
    await database.site.findMany({
      select: { id: true, category_id: true },
      orderBy: { id: "asc" },
    }),
  ).toEqual(before);
  await expect(page.locator(".dragging")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "完成管理", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("搜索网站").click();
  await page.getByLabel("搜索网站").pressSequentially("github", { delay: 40 });
  await expect(
    page.getByRole("button", { name: "拖动网站 GitHub", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "清除搜索", exact: true })
    .first()
    .click();
  await edit(page, "ChatGPT");
  await page.getByLabel("网站名称").fill("未丢失的修改");
  await database.adminSession.deleteMany();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "管理验证" })).toBeVisible();
  await page.getByLabel("管理密码").fill(password);
  await page.getByRole("button", { name: "进入管理", exact: true }).click();
  await expect(page.getByLabel("网站名称")).toHaveValue("未丢失的修改");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("responsive grids, menus, hover, 100 cards and screenshot evidence", async ({
  page,
}, info) => {
  await demo(6);
  await page.goto("/");
  const errorLogs: string[] = [];
  page.on("pageerror", (e) => errorLogs.push(e.message));
  for (const [width, columns] of [
    [1536, 5],
    [1200, 4],
    [900, 3],
    [390, 2],
    [360, 2],
  ]) {
    await page.setViewportSize({ width, height: 1024 });
    await expect
      .poll(() =>
        page
          .locator(".site-grid")
          .first()
          .evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
          ),
      )
      .toBe(columns);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const boxes = await page
      .locator(".site-grid")
      .first()
      .locator(".site-card")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }),
      );
    expect(
      Math.max(...boxes.map((b) => b.w)) - Math.min(...boxes.map((b) => b.w)),
    ).toBeLessThan(1);
    expect(boxes[columns].x).toBeCloseTo(boxes[0].x, 0);
  }
  await page.setViewportSize({ width: 1536, height: 1024 });
  await database.site.deleteMany({ where: { name: "示例网站 5" } });
  await page.reload();
  const evidence = path.resolve("backups/v1.1.0/evidence");
  fs.mkdirSync(evidence, { recursive: true });
  await expect(
    page.getByRole("button", { name: "管理", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, info.project.name + "-home.png"),
    fullPage: true,
  });
  await login(page);
  await page.getByRole("button", { name: "常用更多操作", exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, info.project.name + "-admin.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("region", { name: "常用", exact: true })
    .getByRole("button", { name: "添加网站", exact: true })
    .click();
  await page.getByLabel("网站名称").fill("ChatGPT");
  await page.getByLabel("网站地址").fill("http://127.0.0.1");
  await page.getByLabel("网站说明").fill("AI 对话助手");
  await expect(
    page.getByText("未获取到网站图标，将使用默认图标"),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, info.project.name + "-dialog.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, info.project.name + "-mobile-dialog.png"),
  });
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(390);
  expect(dialog!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "常用更多操作", exact: true }).click();
  const menu = await page.getByRole("menu").boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  await page.screenshot({
    animations: "disabled",
    path: path.join(evidence, info.project.name + "-mobile.png"),
    fullPage: true,
  });
  const c = await database.category.findFirstOrThrow();
  for (let i = 0; i < 70; i++)
    await database.site.create({
      data: {
        category_id: c.id,
        name: "性能测试 " + i,
        url: "https://example.com/" + i,
        sort_order: 100 + i,
      },
    });
  const started = Date.now();
  await page.reload();
  await expect(page.locator(".site-card")).toHaveCount(100);
  expect(Date.now() - started).toBeLessThan(10000);
  expect(errorLogs).toEqual([]);
});

test("category editing, duplicate names, empty visibility, keyboard access and retry states", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await login(page);
  await page
    .getByRole("button", { name: "添加第一个分类", exact: true })
    .click();
  await page.getByLabel("分类名称").fill("   ");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("名称不能为空")).toBeVisible();
  await page.getByLabel("分类名称").fill("  Trimmed  ");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const initial = await database.category.findFirstOrThrow();
  await page
    .getByRole("button", { name: "Trimmed更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "编辑分类", exact: true }).click();
  await expect(page.getByLabel("分类名称")).toHaveValue("Trimmed");
  await page.getByLabel("分类名称").fill("Renamed");
  await page.route("**/api/admin/categories/" + initial.id, (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "分类保存失败" }),
    }),
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("分类保存失败")).toBeVisible();
  await expect(page.getByLabel("分类名称")).toHaveValue("Renamed");
  await page.unroute("**/api/admin/categories/" + initial.id);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const renamed = await database.category.findUniqueOrThrow({
    where: { id: initial.id },
  });
  expect(renamed.sort_order).toBe(initial.sort_order);
  expect(renamed.name).toBe("Renamed");
  await addCategory(page, "Duplicate");
  await addCategory(page, "Duplicate");
  expect(await database.category.count({ where: { name: "Duplicate" } })).toBe(
    2,
  );
  await addSite(page, "Renamed", "Keyboard Link", "http://example.com", "");
  await page.getByRole("button", { name: "完成管理", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Duplicate", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Keyboard Link/ })).toContainText(
    "example.com",
  );
  await page.getByRole("link", { name: /Keyboard Link/ }).focus();
  const popup = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const opened = await popup;
  expect(opened.url()).toContain("example.com");
  await opened.close();
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByText("Keyboard Link", { exact: true }),
  ).toBeVisible();
  await second.close();
  await login(page);
  await page
    .getByRole("button", { name: "Keyboard Link更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  const s = await database.site.findFirstOrThrow();
  await page.route("**/api/admin/sites/" + s.id, (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "删除失败" }),
    }),
  );
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("删除失败", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.unroute("**/api/admin/sites/" + s.id);
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
