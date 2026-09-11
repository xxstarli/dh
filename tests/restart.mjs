import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const root = path.resolve("storage/e2e");
const env = {
  ...process.env,
  DATABASE_URL: "file:" + path.join(root, "test.db").replaceAll("\\", "/"),
  UPLOAD_DIR: path.join(root, "icons"),
  APP_ORIGIN: "https://navigation.example",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.NEXT_BUILD_DIR;
const database = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
const existingIcon = fs
  .readdirSync(path.join(root, "icons"))
  .find((n) => n.endsWith(".webp"));
assert.ok(existingIcon);
const category = await database.category.create({
  data: { name: "重启持久化验收", sort_order: 999 },
});
await database.site.create({
  data: {
    name: "持久化网站",
    url: "https://example.com",
    category_id: category.id,
    sort_order: 17,
    icon_type: "custom",
    icon_url: "/api/icons/" + existingIcon,
  },
});
await database.$disconnect();
async function run() {
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "3101",
      "--hostname",
      "127.0.0.1",
    ],
    { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  child.stderr.on("data", (b) => {
    log += b;
  });
  try {
    let response;
    for (let i = 0; i < 100; i++) {
      try {
        response = await fetch("http://localhost:3101/api/navigation");
        if (response.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!response?.ok) throw new Error("Production start failed: " + log);
    const data = await response.json();
    const auth = await fetch("http://localhost:3101/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: env.APP_ORIGIN },
      body: JSON.stringify({ password: "Navigation-test-only-2026" }),
    });
    assert.equal(auth.status, 200);
    const cookie = auth.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=strict/i);
    const icons = fs
      .readdirSync(path.join(root, "icons"))
      .filter((n) => n.endsWith(".webp"));
    assert.ok(icons.length > 0);
    for (const name of icons)
      assert.equal(
        (await fetch("http://localhost:3101/api/icons/" + name)).status,
        200,
      );
    return { data, icons };
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
}
const first = await run(),
  second = await run();
assert.deepEqual(second, first);
fs.writeFileSync(
  "docs/evidence/restart.json",
  JSON.stringify(
    {
      passed: true,
      categories: first.data.categories.length,
      sites: first.data.categories.reduce((n, c) => n + c.sites.length, 0),
      icons: first.icons.length,
      productionStarts: 2,
      secureCookieVerified: true,
    },
    null,
    2,
  ),
);
console.log(
  "Production restart persistence passed: data, ordering, settings and uploaded icons unchanged.",
);
