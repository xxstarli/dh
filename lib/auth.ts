import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { AppError } from "./errors";
export const COOKIE = "navigation_admin";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function authenticated() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await db.adminSession.findUnique({
    where: { id: digest(token) },
  });
  return !!session && session.expires_at.getTime() > Date.now();
}
export async function requireAdmin() {
  if (!(await authenticated()))
    throw new AppError("UNAUTHORIZED", "管理会话已失效，请重新验证", 401);
}
export function sameOrigin(request: Request) {
  const configured = process.env.APP_ORIGIN;
  if (!configured) throw new AppError("CONFIG_ERROR", "请配置 APP_ORIGIN", 503);
  if (request.headers.get("origin") !== new URL(configured).origin)
    throw new AppError("INVALID_ORIGIN", "请求来源无效，请从站点页面操作", 403);
}
const rateGlobal = globalThis as unknown as { loginAttempts?: number[] };
export async function login(password: string) {
  const now = Date.now();
  rateGlobal.loginAttempts = (rateGlobal.loginAttempts || []).filter(
    (t) => now - t < 60000,
  );
  if (rateGlobal.loginAttempts.length >= 10)
    throw new AppError("RATE_LIMITED", "尝试次数过多，请一分钟后重试", 429);
  rateGlobal.loginAttempts.push(now);
  const settings = await db.settings.findUnique({ where: { id: "singleton" } });
  if (
    !settings ||
    !(await bcrypt.compare(password, settings.admin_password_hash))
  )
    throw new AppError("INVALID_PASSWORD", "管理密码错误，请重新输入", 401);
  rateGlobal.loginAttempts = [];
  const token = randomBytes(32).toString("hex");
  const hours = Math.min(
    24,
    Math.max(1, Number(process.env.SESSION_HOURS) || 12),
  );
  const expires = new Date(now + hours * 3600000);
  const jar = await cookies();
  const previous = jar.get(COOKIE)?.value;
  await db.$transaction(async (tx) => {
    await tx.adminSession.deleteMany({
      where: {
        OR: [
          { expires_at: { lte: new Date() } },
          ...(previous ? [{ id: digest(previous) }] : []),
        ],
      },
    });
    await tx.adminSession.create({
      data: { id: digest(token), expires_at: expires },
    });
  });
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    sameSite: "strict",
    path: "/",
    expires,
  });
}
export async function logout() {
  const jar = await cookies(),
    token = jar.get(COOKIE)?.value;
  if (token) await db.adminSession.deleteMany({ where: { id: digest(token) } });
  jar.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
