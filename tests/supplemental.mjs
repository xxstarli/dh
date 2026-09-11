import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const results = [];
for (const channel of ["chrome", "msedge"]) {
  let browser = await chromium.launch({ channel });
  let page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  await page.goto("http://localhost:3100");
  await expect(
    page.getByRole("button", { name: "管理", exact: true }),
  ).toBeEnabled();
  const cards = page.locator("a.site-card");
  const names = await cards.allTextContents();
  expect(names.length).toBeGreaterThan(0);
  const card = cards.first();
  const before = await card.boundingBox();
  const neighborBefore = await cards.last().boundingBox();
  await card.hover();
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
    .toBe("matrix(1, 0, 0, 1, 0, -2)");
  expect(await card.evaluate((el) => getComputedStyle(el).cursor)).toBe(
    "pointer",
  );
  const after = await card.boundingBox();
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(await cards.last().boundingBox()).toEqual(neighborBefore);
  const version = browser.version();
  await browser.close();
  browser = await chromium.launch({ channel });
  page = await browser.newPage({ viewport: { width: 1536, height: 1024 } });
  await page.goto("http://localhost:3100");
  await expect(page.locator("a.site-card")).toHaveText(names);
  await page.getByRole("button", { name: "管理", exact: true }).click();
  await page
    .getByLabel("管理密码", { exact: true })
    .fill("Navigation-test-only-2026");
  await page.getByRole("button", { name: "进入管理", exact: true }).click();
  await page.getByRole("button", { name: "添加分类", exact: true }).click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "添加分类", exact: true }).click();
  await page.getByRole("button", { name: "关闭弹窗", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "添加分类", exact: true }).click();
  await page.getByLabel("分类名称").fill("Pending verification");
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/api/admin/categories", async (route) => {
    requests++;
    await held;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "延迟失败验收" }),
    });
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存中…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "取消", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "关闭弹窗", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(requests).toBe(1);
  release();
  await expect(page.getByText("延迟失败验收")).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.unroute("**/api/admin/categories");
  await page
    .getByRole("button", { name: "Renamed更多操作", exact: true })
    .click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("menu")).toHaveCount(0);
  const siteName = "持久化网站";
  await page
    .getByRole("button", { name: siteName + "更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(siteName);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText(siteName, { exact: true })).toBeVisible();
  const beforeDelete = await (
    await page.request.get("http://localhost:3100/api/navigation")
  ).json();
  const site = beforeDelete.categories
    .flatMap((c) => c.sites)
    .find((s) => s.name === siteName);
  let releaseDelete;
  const heldDelete = new Promise((resolve) => {
    releaseDelete = resolve;
  });
  await page.route("**/api/admin/sites/" + site.id, async (route) => {
    await heldDelete;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "延迟删除失败" }),
    });
  });
  await page
    .getByRole("button", { name: siteName + "更多操作", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "删除中…", exact: true }),
  ).toBeDisabled();
  releaseDelete();
  await expect(page.getByText("延迟删除失败", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.unroute("**/api/admin/sites/" + site.id);
  await page.setViewportSize({ width: 360, height: 480 });
  await page
    .getByRole("region", { name: "重启持久化验收", exact: true })
    .getByRole("button", { name: "添加网站", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await dialog.hover();
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  const result = await (
    await page.request.get("http://localhost:3100/api/navigation")
  ).json();
  const bing = result.categories
    .flatMap((c) => c.sites)
    .find((s) => s.name === "Bing");
  expect(bing.icon_type).toBe("auto");
  expect(
    (await page.request.get("http://localhost:3100" + bing.icon_url)).status(),
  ).toBe(200);
  results.push({
    channel,
    version,
    passed: true,
    checks: [
      "hover and neighboring layout",
      "full browser close/reopen persistence",
      "modal cancel/close/backdrop",
      "pending save prevents duplicate and dismissal",
      "menu outside dismissal",
      "delete cancel and pending lock",
      "360x480 modal scrolling",
      "live Bing automatic icon persisted",
    ],
  });
  await browser.close();
}
fs.writeFileSync(
  "docs/evidence/supplemental.json",
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
