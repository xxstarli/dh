import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import bcrypt from "bcryptjs";
const production = process.env.E2E_PRODUCTION === "1";
const root = path.resolve("storage/e2e");
fs.mkdirSync(root, { recursive: true });
const env = {
  ...process.env,
  DATABASE_URL: "file:" + path.join(root, "test.db").replaceAll("\\", "/"),
  UPLOAD_DIR: path.join(root, "icons"),
  APP_ORIGIN: "http://localhost:3100",
  ADMIN_PASSWORD_HASH: bcrypt.hashSync("Navigation-test-only-2026", 12),
  NEXT_BUILD_DIR: production
    ? process.env.NEXT_BUILD_DIR || ".next"
    : ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const args of [
  ["scripts/migrate.mjs"],
  ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    production ? "start" : "dev",
    "--port",
    "3100",
    "--hostname",
    "127.0.0.1",
  ],
  { env, stdio: "inherit" },
);
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));
