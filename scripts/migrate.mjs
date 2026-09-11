import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:"))
  throw new Error("DATABASE_URL 必须使用 SQLite file: 路径");
const location = url.slice(5);
const file = path.isAbsolute(location)
  ? location
  : path.resolve("prisma", location);
fs.mkdirSync(path.dirname(file), { recursive: true });
if (!fs.existsSync(file)) fs.closeSync(fs.openSync(file, "wx"));
const result = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
