import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
export function ok(data: unknown = { success: true }, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return ok(
      { success: false, code: error.code, message: error.message },
      error.status,
    );
  if (error instanceof ZodError)
    return ok(
      {
        success: false,
        code: "INVALID_INPUT",
        message: error.issues[0]?.message || "输入无效",
        fields: error.flatten().fieldErrors,
      },
      400,
    );
  console.error(
    "Navigation operation failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return ok(
    { success: false, code: "SAVE_FAILED", message: "操作失败，请稍后重试" },
    500,
  );
}
export async function limitedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_INPUT", "请求内容不能为空");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit)
        throw new AppError("UPLOAD_TOO_LARGE", "请求内容过大", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse((await limitedBody(request, 16384)).toString());
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("INVALID_INPUT", "请求格式无效");
  }
}
